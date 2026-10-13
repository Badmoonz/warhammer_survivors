/**
 * game.ts — core survivors-like gameplay: hero, skaven waves, weapons,
 * XP/level-ups, pickups, effects, camera.
 */
import * as pc from 'playcanvas';
import { FrameKey } from './art';
import { SpriteLib } from './textures';
import { UI, UpgradeChoice, HudState } from './ui';

export const VIEW_H = 260;      // visible world height in units
const ARENA = 460;              // playable half-extent
const MAX_ENEMIES = 300;
const MAX_GEMS = 200;
const WIN_TIME = 300;           // 5 minutes

const HERO_HP = 100;
const HERO_SPEED = 76;
const HERO_RADIUS = 5.5;
const SLASH_DURATION = 0.16;
const ENEMY_ATTACK_DURATION = 0.28;
const ENEMY_MELEE_GAP = 3;

type EnemyKind = 'clanrat' | 'monk' | 'stormvermin' | 'elite' | 'ogre';

interface EnemyDef {
    frames: [FrameKey, FrameKey];
    attackFrames: [FrameKey, FrameKey, FrameKey, FrameKey];
    hp: number; speed: number; dmg: number; radius: number; scale: number;
    gem: FrameKey; xp: number;
}

const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
    clanrat:     { frames: ['rat0', 'rat1'],   attackFrames: ['rat_a0', 'rat_a1', 'rat_a2', 'rat_a3'], hp: 9,   speed: 34, dmg: 8,  radius: 5.5, scale: 1,    gem: 'gems', xp: 1 },
    monk:        { frames: ['monk0', 'monk1'], attackFrames: ['monk_a0', 'monk_a1', 'monk_a2', 'monk_a3'], hp: 16,  speed: 47, dmg: 10, radius: 5.5, scale: 1,    gem: 'gems', xp: 2 },
    stormvermin: { frames: ['sv0', 'sv1'],     attackFrames: ['sv_a0', 'sv_a1', 'sv_a2', 'sv_a3'], hp: 46,  speed: 29, dmg: 16, radius: 6,   scale: 1.05, gem: 'gemm', xp: 4 },
    elite:       { frames: ['sv0', 'sv1'],     attackFrames: ['sv_a0', 'sv_a1', 'sv_a2', 'sv_a3'], hp: 240, speed: 37, dmg: 20, radius: 8,   scale: 1.55, gem: 'geml', xp: 25 },
    ogre:        { frames: ['ogre0', 'ogre1'], attackFrames: ['ogre_a0', 'ogre_a1', 'ogre_a2', 'ogre_a3'], hp: 950, speed: 22, dmg: 34, radius: 11,  scale: 1.35, gem: 'geml', xp: 25 },
};

/** Fyresteel greataxe: melee slash arc in the hero's facing direction. */
const SLASH_LEVELS = [
    { cd: 1.0, dmg: 16, reach: 36, arcDeg: 110, backswing: false },
    { cd: 1.0, dmg: 16, reach: 42, arcDeg: 120, backswing: true },
    { cd: 0.95, dmg: 24, reach: 42, arcDeg: 120, backswing: true },
    { cd: 0.8, dmg: 24, reach: 48, arcDeg: 140, backswing: true },
    { cd: 0.62, dmg: 34, reach: 52, arcDeg: 170, backswing: true },
];
const NOVA_LEVELS = [
    { cd: 4.2, radius: 56, dmg: 16, kb: 110 },
    { cd: 4.2, radius: 74, dmg: 16, kb: 110 },
    { cd: 4.2, radius: 74, dmg: 26, kb: 120 },
    { cd: 3.3, radius: 74, dmg: 26, kb: 120 },
    { cd: 3.0, radius: 92, dmg: 38, kb: 140 },
];
const PASSIVE_MAX = 3;

interface Enemy {
    id: number; kind: EnemyKind;
    x: number; y: number; hp: number; maxHp: number;
    speed: number; dmg: number; radius: number; scale: number;
    kbx: number; kby: number;
    animT: number; faceLeft: boolean; hitCd: number; flashT: number;
    attackT: number; attackLeft: boolean;
    gem: FrameKey; xp: number; isBoss: boolean;
    entity: pc.Entity;
}

interface SlashFx {
    active: boolean; t: number; dur: number; angle: number; size: number; x: number; y: number;
    entity: pc.Entity; mat: pc.StandardMaterial;
}

interface Gem {
    x: number; y: number; value: number; fly: boolean; speed: number;
    bob: number; entity: pc.Entity | null; active: boolean;
}

interface Fx {
    kind: 'puff' | 'ember';
    x: number; y: number; vx: number; vy: number;
    t: number; dur: number; scale: number; active: boolean; entity: pc.Entity | null;
}

interface RingFx {
    active: boolean; t: number; dur: number; radius: number;
    entity: pc.Entity; mat: pc.StandardMaterial;
}

interface Pickup {
    kind: 'heart'; x: number; y: number; bob: number; entity: pc.Entity | null; active: boolean;
}

type GameState = 'menu' | 'playing' | 'levelup' | 'dead' | 'victory';

const q = new pc.Quat();

export class Game {
    private app: pc.AppBase;
    private lib: SpriteLib;
    private ui: UI;
    private camera: pc.Entity;
    private root: pc.Entity;

    state: GameState = 'menu';
    debugBot = false; debugGod = false;

    // hero
    private hero!: pc.Entity;
    hx = 0; hy = 0;
    private hp = HERO_HP; private maxHp = HERO_HP;
    private walkT = 0; private facing: 'd' | 'u' | 's' = 'd'; private faceLeft = false;
    private attackT = 0; private attackFacing: 'd' | 'u' | 's' = 'd'; private attackLeft = false;
    private hurtCd = 0;

    // progression
    private elapsed = 0;
    private xp = 0; private level = 1; private kills = 0;
    private pendingLevelUps = 0;
    private victoryShown = false;

    // weapons
    private slashLevel = 1; private slashCd = 0.4;
    private slashQueue: Array<{ t: number; dx: number; dy: number }> = [];
    private novaLevel = 0; private novaCd = 2.0;   // 0 = not owned yet

    // passives
    private might = 0; private swift = 0; private heart = 0; private lure = 0;

    // entities
    private enemies: Enemy[] = [];
    private gems: Gem[] = [];
    private pickups: Pickup[] = [];
    private fx: Fx[] = [];
    private rings: RingFx[] = [];
    private slashes: SlashFx[] = [];
    private nextId = 1;

    // spawner
    private spawnAcc = 0; private monkPackT = 10; private svAcc = 0;
    private eliteT = 75; private bossT = 150; private bossCount = 0;

    // pools
    private pool: pc.Entity[] = [];
    private camX = 0; private camY = 0;
    private hudT = 0;
    private botT = 0; private botX = 0; private botY = 0;

    constructor(app: pc.AppBase, lib: SpriteLib, ui: UI, camera: pc.Entity) {
        this.app = app; this.lib = lib; this.ui = ui; this.camera = camera;
        this.emberMat = lib.makeMaterial(lib.textures.get('ember')!, true, 1);
        this.root = new pc.Entity('game');
        app.root.addChild(this.root);

        this.hero = lib.makeSprite('hero_d0', 1.15);
        this.root.addChild(this.hero);

        for (let i = 0; i < 6; i++) {
            const e = lib.makeSprite('ring', 1);
            e.enabled = false;
            const mat = lib.makeMaterial(lib.textures.get('ring')!, true, 1);
            this.root.addChild(e);
            this.rings.push({ active: false, t: 0, dur: 0.38, radius: 60, entity: e, mat });
        }
        for (let i = 0; i < 8; i++) {
            const e = lib.makeSprite('slash', 1);
            e.enabled = false;
            const mat = lib.makeMaterial(lib.textures.get('slash')!, true, 1);
            this.root.addChild(e);
            this.slashes.push({ active: false, t: 0, dur: SLASH_DURATION, angle: 0, size: 40, x: 0, y: 0, entity: e, mat });
        }

        const params = new URLSearchParams(location.search);
        this.debugBot = params.get('bot') === '1';
        this.debugGod = params.get('god') === '1';
        const t0 = Number(params.get('t') ?? 0);
        if (t0 > 0) this.elapsed = t0;

        ui.showStart(() => {
            this.state = 'playing';
            ui.banner('THE SKAVEN TIDE COMES', 2800);
        });
    }

    // ------------------------------------------------------------------ pools

    private acquire(): pc.Entity {
        let e = this.pool.pop();
        if (!e) {
            e = this.lib.makeSprite('rat0');
            this.root.addChild(e);
        }
        e.enabled = true;
        e.setLocalEulerAngles(-90, 0, 0); // pooled entities must not inherit foreign rotations
        return e;
    }

    private release(e: pc.Entity): void {
        e.enabled = false;
        this.pool.push(e);
    }

    // ------------------------------------------------------------------ spawn

    private spawnPos(): { x: number; y: number } {
        const halfH = VIEW_H / 2;
        const halfW = (this.app.graphicsDevice.width / Math.max(1, this.app.graphicsDevice.height)) * halfH;
        const dist = Math.hypot(halfW, halfH) + 30 + Math.random() * 60;
        for (let tries = 0; tries < 6; tries++) {
            const a = Math.random() * Math.PI * 2;
            const x = this.hx + Math.cos(a) * dist;
            const y = this.hy + Math.sin(a) * dist;
            if (Math.abs(x) < ARENA && Math.abs(y) < ARENA) return { x, y };
        }
        const a = Math.random() * Math.PI * 2;
        return {
            x: Math.max(-ARENA, Math.min(ARENA, this.hx + Math.cos(a) * dist)),
            y: Math.max(-ARENA, Math.min(ARENA, this.hy + Math.sin(a) * dist)),
        };
    }

    private spawnEnemy(kind: EnemyKind, x?: number, y?: number): void {
        // bosses and elites always spawn, even above the crowd cap
        const isHeavy = kind === 'ogre' || kind === 'elite';
        if (!isHeavy && this.enemies.length >= MAX_ENEMIES) return;
        const d = ENEMY_DEFS[kind];
        const p = x === undefined || y === undefined ? this.spawnPos() : { x, y };
        const hpScale = (1 + this.elapsed / 210) * (this.elapsed >= WIN_TIME ? 1.4 : 1);
        const speedJit = 0.85 + Math.random() * 0.3;
        const e = this.acquire();
        const enemy: Enemy = {
            id: this.nextId++, kind,
            x: p.x, y: p.y, hp: d.hp * hpScale, maxHp: d.hp * hpScale,
            speed: d.speed * speedJit, dmg: d.dmg, radius: d.radius, scale: d.scale,
            kbx: 0, kby: 0,
            animT: Math.random() * 2, faceLeft: false, hitCd: 0, flashT: 0,
            attackT: 0, attackLeft: false,
            gem: d.gem, xp: d.xp, isBoss: kind === 'ogre',
            entity: e,
        };
        this.lib.applyFrame(e, d.frames[0], d.scale);
        e.setPosition(p.x, p.y, this.zOf(p.y));
        this.enemies.push(enemy);
    }

    // ------------------------------------------------------------------ main

    update(dt: number): void {
        if (this.state === 'menu' || this.state === 'dead') { this.updateCamera(dt, true); return; }
        if (this.state === 'levelup') return;

        this.elapsed += dt;
        this.updateHero(dt);
        this.updateSpawner(dt);
        this.updateEnemies(dt);
        this.updateWeapons(dt);
        this.updateGems(dt);
        this.updateFx(dt);
        this.updateCamera(dt, false);

        this.hudT -= dt;
        if (this.hudT <= 0) {
            this.hudT = 0.12;
            this.ui.updateHUD(this.hudState());
        }

        if (this.elapsed >= WIN_TIME && !this.victoryShown) {
            this.victoryShown = true;
            this.state = 'victory';
            this.ui.showVictory(this.hudState(), () => { this.state = 'playing'; });
        }
    }

    private hudState(): HudState {
        return {
            hp: Math.max(0, this.hp), maxHp: this.maxHp, hpRegen: this.heart * 0.6,
            xp: this.xp, xpNext: this.xpNext(), level: this.level,
            time: this.elapsed, kills: this.kills,
            might: this.might * 0.15, swift: this.swift * 0.1,
        };
    }

    private xpNext(): number {
        return Math.round(6 * Math.pow(this.level, 1.3) + 4);
    }

    // ------------------------------------------------------------------ hero

    private inputVector(): { x: number; y: number } {
        if (this.debugBot) return { x: this.botX, y: this.botY };
        const k = this.app.keyboard!;
        let x = 0, y = 0;
        if (k.isPressed(pc.KEY_W) || k.isPressed(pc.KEY_UP)) y += 1;
        if (k.isPressed(pc.KEY_S) || k.isPressed(pc.KEY_DOWN)) y -= 1;
        if (k.isPressed(pc.KEY_A) || k.isPressed(pc.KEY_LEFT)) x -= 1;
        if (k.isPressed(pc.KEY_D) || k.isPressed(pc.KEY_RIGHT)) x += 1;
        const len = Math.hypot(x, y);
        if (len > 0) { x /= len; y /= len; }
        return { x, y };
    }

    private updateBot(dt: number): void {
        this.botT -= dt;
        if (this.botT > 0) return;
        this.botT = 0.12;
        // melee autopilot: engage the nearest enemy, then strafe around it
        let nearest: Enemy | null = null, nearestD = Infinity;
        for (const e of this.enemies) {
            const d = Math.hypot(e.x - this.hx, e.y - this.hy);
            if (d < nearestD) { nearestD = d; nearest = e; }
        }
        let vx = 0, vy = 0;
        if (nearest && nearestD < 260) {
            const tx = (nearest.x - this.hx) / nearestD, ty = (nearest.y - this.hy) / nearestD;
            if (nearestD > 70) {
                vx = tx; vy = ty;                                  // close in
            } else {
                vx = -ty; vy = tx;                                 // circle-strafe
                if (Math.abs(this.hx + vx * 80) > ARENA - 40 || Math.abs(this.hy + vy * 80) > ARENA - 40) {
                    vx = -vx; vy = -vy;                            // stay inside the arena
                }
            }
        } else {
            // nothing nearby: grab the closest warpstone
            let bestGem: Gem | null = null, bestD = Infinity;
            for (const g of this.gems) {
                if (!g.active) continue;
                const d = Math.hypot(g.x - this.hx, g.y - this.hy);
                if (d < bestD) { bestD = d; bestGem = g; }
            }
            if (bestGem && bestD > 0.01) {
                vx = (bestGem.x - this.hx) / bestD;
                vy = (bestGem.y - this.hy) / bestD;
            }
        }
        const len = Math.hypot(vx, vy);
        if (len > 0.01) { vx /= len; vy /= len; this.botX = vx; this.botY = vy; }
        else { this.botX = 0; this.botY = 0; }
    }

    private updateHero(dt: number): void {
        if (this.debugBot) this.updateBot(dt);
        const v = this.inputVector();
        const speed = HERO_SPEED * (1 + this.swift * 0.1);
        this.hx = Math.max(-ARENA, Math.min(ARENA, this.hx + v.x * speed * dt));
        this.hy = Math.max(-ARENA, Math.min(ARENA, this.hy + v.y * speed * dt));

        if (v.x !== 0 || v.y !== 0) {
            this.walkT += dt;
            if (Math.abs(v.x) > Math.abs(v.y)) this.facing = 's';
            else this.facing = v.y > 0 ? 'u' : 'd';
            if (v.x !== 0) this.faceLeft = v.x < 0;
        } else {
            this.walkT = 0;
        }
        this.attackT = Math.max(0, this.attackT - dt);
        this.applyHeroFrame();
        this.hero.setPosition(this.hx, this.hy, this.zOf(this.hy) + 1);

        // regen
        if (this.heart > 0 && this.hp < this.maxHp) {
            this.hp = Math.min(this.maxHp, this.hp + this.heart * 0.6 * dt);
        }
        if (this.hurtCd > 0) this.hurtCd -= dt;
    }

    private applyHeroFrame(): void {
        const attacking = this.attackT > 0;
        const phase = Math.min(3, Math.floor((1 - this.attackT / SLASH_DURATION) * 4));
        const key = (attacking ? `hero_a${this.attackFacing}${phase}`
            : `hero_${this.facing}${Math.floor(this.walkT * 7) % 2}`) as FrameKey;
        this.lib.applyFrame(this.hero, key, 1.15, attacking ? this.attackLeft : this.facing === 's' && this.faceLeft);
    }

    // ------------------------------------------------------------------ waves

    private updateSpawner(dt: number): void {
        const t = this.elapsed;
        const surge = t >= WIN_TIME ? 1.4 : 1;

        // clanrats (mix in monks later)
        let rate = Math.min(1.2 + t * 0.028, 7.5) * surge;
        this.spawnAcc += dt * rate;
        while (this.spawnAcc >= 1) {
            this.spawnAcc -= 1;
            this.spawnEnemy(t > 100 && Math.random() < 0.25 ? 'monk' : 'clanrat');
        }

        // plague monk packs
        if (t >= 60) {
            this.monkPackT -= dt;
            if (this.monkPackT <= 0) {
                this.monkPackT = 13;
                const p = this.spawnPos();
                for (let i = 0; i < 8; i++) {
                    this.spawnEnemy('monk', p.x + (Math.random() - 0.5) * 40, p.y + (Math.random() - 0.5) * 40);
                }
                if (t > 240) {
                    for (let i = 0; i < 4; i++) {
                        this.spawnEnemy('monk', p.x + (Math.random() - 0.5) * 60, p.y + (Math.random() - 0.5) * 60);
                    }
                }
            }
        }

        // stormvermin trickle
        if (t >= 150) {
            this.svAcc += dt * (0.15 + t * 0.0012) * surge;
            while (this.svAcc >= 1) {
                this.svAcc -= 1;
                this.spawnEnemy('stormvermin');
            }
        }

        // elite stormvermin
        if (t >= this.eliteT) {
            this.eliteT += 40;
            this.spawnEnemy('elite');
            this.ui.banner('ELITE STORMVERMIN!', 1800);
        }

        // rat ogre boss
        if (t >= this.bossT) {
            this.bossT += 75;
            this.bossCount++;
            this.spawnEnemy('ogre');
            this.ui.banner('A RAT OGRE APPROACHES!', 2600);
        }
    }

    // ------------------------------------------------------------------ enemies

    /** spatial hash cell size */
    private static CELL = 26;
    private grid = new Map<number, Enemy[]>();

    private cellKey(cx: number, cy: number): number {
        return (cx + 2048) * 4096 + (cy + 2048);
    }

    private rebuildGrid(): void {
        this.grid.clear();
        for (const e of this.enemies) {
            const k = this.cellKey(Math.floor(e.x / Game.CELL), Math.floor(e.y / Game.CELL));
            let arr = this.grid.get(k);
            if (!arr) { arr = []; this.grid.set(k, arr); }
            arr.push(e);
        }
    }

    private neighbors(x: number, y: number, out: Enemy[]): Enemy[] {
        out.length = 0;
        const cx = Math.floor(x / Game.CELL), cy = Math.floor(y / Game.CELL);
        for (let ix = cx - 1; ix <= cx + 1; ix++) {
            for (let iy = cy - 1; iy <= cy + 1; iy++) {
                const arr = this.grid.get(this.cellKey(ix, iy));
                if (arr) out.push(...arr);
            }
        }
        return out;
    }

    private nbuf: Enemy[] = [];

    private updateEnemies(dt: number): void {
        this.rebuildGrid();
        const alive: Enemy[] = [];

        for (const e of this.enemies) {
            // seek hero
            const dx = this.hx - e.x, dy = this.hy - e.y;
            const d = Math.hypot(dx, dy) || 1;
            const meleeDistance = e.radius + HERO_RADIUS + ENEMY_MELEE_GAP;
            const step = Math.min(e.speed * dt, Math.max(0, d - meleeDistance));
            e.x += (dx / d) * step + e.kbx * dt;
            e.y += (dy / d) * step + e.kby * dt;
            e.kbx *= Math.pow(0.001, dt); e.kby *= Math.pow(0.001, dt);
            if (Math.abs(e.kbx) < 1) e.kbx = 0;
            if (Math.abs(e.kby) < 1) e.kby = 0;

            // separation
            const nb = this.neighbors(e.x, e.y, this.nbuf);
            let checks = 0;
            for (const o of nb) {
                if (o === e) continue;
                if (++checks > 7) break;
                const ox = e.x - o.x, oy = e.y - o.y;
                const od = Math.hypot(ox, oy);
                const min = e.radius + o.radius;
                if (od < min && od > 0.01) {
                    const push = (min - od) * 0.5;
                    e.x += (ox / od) * push;
                    e.y += (oy / od) * push;
                } else if (od <= 0.01) {
                    e.x += (Math.random() - 0.5);
                    e.y += (Math.random() - 0.5);
                }
            }

            // Separation cannot leave the monster overlapping the hero.
            const ex = e.x - this.hx, ey = e.y - this.hy;
            const distance = Math.hypot(ex, ey);
            if (distance < meleeDistance) {
                const angle = distance > 1e-6 ? Math.atan2(ey, ex) : e.id * 2.399963229728653;
                e.x = this.hx + Math.cos(angle) * meleeDistance;
                e.y = this.hy + Math.sin(angle) * meleeDistance;
            }
            if (this.hx - e.x < -0.5) e.faceLeft = true;
            else if (this.hx - e.x > 0.5) e.faceLeft = false;

            // contact damage (only from enemies that actually own a visible entity)
            e.attackT = Math.max(0, e.attackT - dt);
            if (e.hitCd > 0) e.hitCd -= dt;
            if (e.entity.enabled && Math.hypot(e.x - this.hx, e.y - this.hy) <= meleeDistance + 1e-6 && e.hitCd <= 0) {
                e.hitCd = 0.55;
                e.attackT = ENEMY_ATTACK_DURATION;
                e.attackLeft = e.faceLeft;
                if (!this.debugGod) {
                    this.hp -= e.dmg;
                    this.ui.damageFlash();
                    if (this.hp <= 0) {
                        this.hp = 0;
                        this.state = 'dead';
                        this.ui.showGameOver(this.hudState());
                        return;
                    }
                }
            }

            // anim + transform
            e.animT += dt * (e.speed / 34);
            const frame = (Math.floor(e.animT * 5) % 2) as 0 | 1;
            const def = ENEMY_DEFS[e.kind];
            const attacking = e.attackT > 0;
            const attackPhase = Math.min(3, Math.floor((1 - e.attackT / ENEMY_ATTACK_DURATION) * 4));
            const pop = e.flashT > 0 ? 1.14 : 1;
            if (e.flashT > 0) e.flashT -= dt;
            this.lib.applyFrame(e.entity, attacking ? def.attackFrames[attackPhase] : def.frames[frame],
                e.scale * pop, attacking ? e.attackLeft : e.faceLeft);
            e.entity.setPosition(e.x, e.y, this.zOf(e.y));

            if (e.hp > 0) alive.push(e);
        }
        this.enemies = alive;
    }

    private killEnemy(e: Enemy, absorbed: boolean): void {
        this.kills++;
        const renderedSize = e.entity.getLocalScale();
        const def = ENEMY_DEFS[e.kind];
        const bodySize = this.lib.size(def.frames[0]);
        const canvasSize = this.lib.size(e.attackT > 0 ? def.attackFrames[0] : def.frames[0]);
        const zoom = Math.max(Math.abs(renderedSize.x) / canvasSize.w, Math.abs(renderedSize.z) / canvasSize.h);
        const puffDiameter = Math.max(bodySize.w, bodySize.h) * zoom;
        this.release(e.entity);
        this.spawnPuff(e.x, e.y, puffDiameter);
        if (!absorbed) {
            this.spawnGem(e.x + (Math.random() - 0.5) * 6, e.y + (Math.random() - 0.5) * 6, e.xp, e.gem);
            if ((e.kind === 'elite' || e.kind === 'ogre') || Math.random() < 0.012) {
                this.spawnPickup(e.x, e.y);
            }
        }
    }

    // ------------------------------------------------------------------ weapons

    private updateWeapons(dt: number): void {
        // Each swing chooses the sector containing the most reachable enemies.
        this.slashCd = Math.max(0, this.slashCd - dt);
        const cfg = SLASH_LEVELS[this.slashLevel - 1];
        if (this.slashCd <= 0) {
            const dir = this.facingDir();
            if (this.swingSlash(dir.x, dir.y, cfg)) {
                this.slashCd = cfg.cd;
                if (cfg.backswing) {
                    this.slashQueue.push({ t: SLASH_DURATION, dx: -dir.x, dy: -dir.y });
                }
            }
        }
        // delayed backswing
        for (const s of this.slashQueue) s.t -= dt;
        while (this.slashQueue.length > 0 && this.slashQueue[0].t <= 0) {
            const s = this.slashQueue.shift()!;
            this.swingSlash(s.dx, s.dy, SLASH_LEVELS[this.slashLevel - 1]);
        }

        // runic fire nova
        if (this.novaLevel > 0) {
            this.novaCd = Math.max(0, this.novaCd - dt);
            if (this.novaCd <= 0) {
                const nova = NOVA_LEVELS[this.novaLevel - 1];
                if (this.castNova(nova.radius, nova.dmg * (1 + this.might * 0.15), nova.kb)) this.novaCd = nova.cd;
            }
        }
    }

    private facingDir(): { x: number; y: number } {
        if (this.facing === 'u') return { x: 0, y: 1 };
        if (this.facing === 'd') return { x: 0, y: -1 };
        return { x: this.faceLeft ? -1 : 1, y: 0 };
    }

    private inSlash(e: Enemy, ux: number, uy: number, cfg: typeof SLASH_LEVELS[0]): boolean {
        const ex = e.x - this.hx, ey = e.y - this.hy;
        const distance = Math.hypot(ex, ey);
        if (distance > cfg.reach + e.radius + 1e-7) return false;
        return distance < 0.001 || (ex * ux + ey * uy) / distance
            >= Math.cos(cfg.arcDeg * Math.PI / 360) - 1e-9;
    }

    private bestSlashDir(dx: number, dy: number, cfg: typeof SLASH_LEVELS[0]): { x: number; y: number } {
        const facing = Math.atan2(dy, dx);
        const halfArc = cfg.arcDeg * Math.PI / 360;
        const angles = this.enemies
            .filter(e => {
                const distance = Math.hypot(e.x - this.hx, e.y - this.hy);
                return distance >= 0.001 && distance <= cfg.reach + e.radius + 1e-7;
            })
            .map(e => Math.atan2(e.y - this.hy, e.x - this.hx))
            .sort((a, b) => a - b);
        const circular = [...angles, ...angles.map(angle => angle + Math.PI * 2)];
        let best = facing;
        let bestCount = this.enemies.filter(e => this.inSlash(e, Math.cos(best), Math.sin(best), cfg)).length;
        let bestTurn = 0;
        let end = 0;
        for (let start = 0; start < angles.length; start++) {
            end = Math.max(end, start);
            while (end + 1 < start + angles.length && circular[end + 1] - circular[start] <= halfArc * 2 + 1e-9) end++;
            const lower = circular[end] - halfArc, upper = circular[start] + halfArc;
            const middle = (lower + upper) / 2;
            // Choose the closest facing direction that still covers this window.
            const nearFacing = middle + Math.atan2(Math.sin(facing - middle), Math.cos(facing - middle));
            const angle = Math.max(lower, Math.min(upper, nearFacing));
            const count = this.enemies.filter(e => this.inSlash(e, Math.cos(angle), Math.sin(angle), cfg)).length;
            const turn = Math.abs(Math.atan2(Math.sin(angle - facing), Math.cos(angle - facing)));
            if (count > bestCount || (count === bestCount && turn < bestTurn)) {
                best = angle; bestCount = count; bestTurn = turn;
            }
        }
        return { x: Math.cos(best), y: Math.sin(best) };
    }

    private swingSlash(dx: number, dy: number, cfg: typeof SLASH_LEVELS[0]): boolean {
        const dmg = cfg.dmg * (1 + this.might * 0.15);
        const direction = this.bestSlashDir(dx, dy, cfg);
        const ux = direction.x, uy = direction.y;
        if (!this.enemies.some(e => this.inSlash(e, ux, uy, cfg))) return false;
        this.attackT = SLASH_DURATION;
        this.attackFacing = Math.abs(ux) > Math.abs(uy) ? 's' : uy > 0 ? 'u' : 'd';
        this.attackLeft = this.attackFacing === 's' && ux < 0;
        this.applyHeroFrame();

        // The crescent shares the damage origin; its authored radius is 14px.
        const s = this.slashes.find((sl) => !sl.active);
        if (s) {
            s.active = true; s.t = 0; s.dur = SLASH_DURATION;
            s.angle = Math.atan2(uy, ux) * 57.29578;
            s.size = cfg.reach * 32 / 14;
            s.x = this.hx; s.y = this.hy;
            s.entity.enabled = true;
            s.entity.setPosition(s.x, s.y, this.zOf(s.y) + 3);
            s.entity.setLocalScale(s.size * 0.96, 1, s.size * 0.96);
            s.entity.setLocalRotation(billboardQuatSafe(s.angle - 8, q));
            s.mat.opacity = 1;
            s.entity.render!.material = s.mat;
        }

        // damage everything inside the arc (a target standing exactly on the
        // hero has no direction but is always inside the swing)
        for (const e of [...this.enemies]) {
            if (!this.inSlash(e, ux, uy, cfg)) continue;
            const ex = e.x - this.hx, ey = e.y - this.hy;
            const d = Math.hypot(ex, ey);
            if (d < 0.001) {
                this.damageEnemy(e, dmg, ux * 170, uy * 170);
            } else {
                this.damageEnemy(e, dmg, (ex / d) * 170, (ey / d) * 170);
            }
        }
        // a few sparks along the swing
        for (let i = 0; i < 3; i++) {
            const a = Math.atan2(uy, ux) + (Math.random() - 0.5) * (cfg.arcDeg * Math.PI / 180);
            this.spawnFx('ember', this.hx + Math.cos(a) * cfg.reach * 0.7, this.hy + Math.sin(a) * cfg.reach * 0.7,
                Math.cos(a) * 40, Math.sin(a) * 40, 0.3);
        }
        return true;
    }

    private castNova(radius: number, dmg: number, kb: number): boolean {
        const targets = this.enemies.filter(e => (e.x - this.hx) ** 2 + (e.y - this.hy) ** 2 <= radius * radius);
        if (targets.length === 0) return false;
        const ring = this.rings.find((r) => !r.active);
        if (ring) {
            ring.active = true; ring.t = 0; ring.radius = radius;
            ring.entity.enabled = true;
            ring.entity.setPosition(this.hx, this.hy, this.zOf(this.hy) + 3);
            ring.mat.opacity = 1;
            ring.entity.render!.material = ring.mat;
        }
        for (const e of targets) {
            const dx = e.x - this.hx, dy = e.y - this.hy;
            const len = Math.hypot(dx, dy) || 1;
            this.damageEnemy(e, dmg, (dx / len) * kb, (dy / len) * kb);
        }
        // embers
        const n = 10;
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
            this.spawnFx('ember', this.hx, this.hy, Math.cos(a) * (60 + Math.random() * 80), Math.sin(a) * (60 + Math.random() * 80), 0.55);
        }
        return true;
    }

    private damageEnemy(e: Enemy, dmg: number, kbx: number, kby: number): void {
        e.hp -= dmg;
        e.flashT = 0.07;
        e.kbx += kbx; e.kby += kby;
        if (e.hp <= 0) {
            this.killEnemy(e, false);
            const i = this.enemies.indexOf(e);
            if (i >= 0) this.enemies.splice(i, 1);
        }
    }

    // ------------------------------------------------------------------ pickups

    private spawnGem(x: number, y: number, value: number, tier: FrameKey): void {
        if (this.gems.length >= MAX_GEMS) {
            // absorb the oldest gem's value into this one to cap entity count
            const old = this.gems.shift()!;
            value += old.value;
            this.recycleGem(old);
        }
        // a pooled gem struct never keeps its entity: the old one may already
        // have been reused by another pool user, which corrupted ownership
        let g = this.freeGems.pop();
        if (!g) {
            g = { x, y, value, fly: false, speed: 0, bob: 0, entity: null, active: true };
        }
        g.x = x; g.y = y; g.value = value; g.fly = false; g.speed = 0;
        g.bob = Math.random() * 6; g.active = true;
        g.entity = this.acquire();
        const key: FrameKey = value >= 25 ? 'geml' : value >= 4 ? 'gemm' : tier;
        this.lib.applyFrame(g.entity, key, 1);
        g.entity.setPosition(x, y, this.zOf(y) - 2);
        this.gems.push(g);
    }

    private recycleGem(g: Gem): void {
        if (g.entity) {
            this.release(g.entity);
            g.entity = null;
        }
        g.active = false;
        this.freeGems.push(g);
    }
    private freeGems: Gem[] = [];

    private spawnPickup(x: number, y: number): void {
        let p = this.pickups.find((pp) => !pp.active);
        if (!p) {
            p = { kind: 'heart', x, y, bob: 0, entity: null, active: false };
            this.pickups.push(p);
        }
        p.x = x; p.y = y; p.bob = Math.random() * 6; p.active = true;
        p.entity = this.acquire();
        this.lib.applyFrame(p.entity, 'heart', 1.1);
        p.entity.setPosition(x, y, this.zOf(y) - 1);
    }

    private updateGems(dt: number): void {
        const magnet = 44 * (1 + this.lure * 0.4);
        for (let i = this.gems.length - 1; i >= 0; i--) {
            const g = this.gems[i];
            g.bob += dt * 4;
            const dx = this.hx - g.x, dy = this.hy - g.y;
            const d = Math.hypot(dx, dy);
            if (!g.fly && d < magnet) g.fly = true;
            if (g.fly) {
                g.speed = Math.max(240, g.speed + 1400 * dt);
                if (d > 0.01) {
                    g.x += (dx / d) * g.speed * dt;
                    g.y += (dy / d) * g.speed * dt;
                }
            }
            if (d < 9) {
                this.gems.splice(i, 1);
                this.recycleGem(g);
                this.addXp(g.value);
                continue;
            }
            g.entity!.setPosition(g.x, g.y + Math.sin(g.bob) * 1.5, this.zOf(g.y) - 2);
        }

        for (const p of this.pickups) {
            if (!p.active) continue;
            p.bob += dt * 3;
            const d = Math.hypot(this.hx - p.x, this.hy - p.y);
            if (d < 10) {
                p.active = false;
                if (p.entity) { this.release(p.entity); p.entity = null; }
                this.hp = Math.min(this.maxHp, this.hp + 30);
                this.ui.banner('+30 HP', 900);
                continue;
            }
            p.entity!.setPosition(p.x, p.y + Math.sin(p.bob) * 2, this.zOf(p.y) - 1);
        }
    }

    private addXp(v: number): void {
        this.xp += v;
        while (this.xp >= this.xpNext()) {
            this.xp -= this.xpNext();
            this.level++;
            this.pendingLevelUps++;
        }
        if (this.pendingLevelUps > 0 && this.state === 'playing') {
            this.openLevelUp();
        }
    }

    // ------------------------------------------------------------------ upgrades

    private openLevelUp(): void {
        this.state = 'levelup';
        const choices = this.buildChoices();
        const apply = (c: UpgradeChoice) => {
            this.applyChoice(c.id);
            this.pendingLevelUps--;
            if (this.pendingLevelUps > 0) this.openLevelUp();
            else this.state = 'playing';
        };
        this.ui.showLevelUp(choices, apply);
    }

    private icon(key: FrameKey): HTMLCanvasElement {
        return this.lib.art.frames[key].canvas;
    }

    private buildChoices(): UpgradeChoice[] {
        type Cand = { c: UpgradeChoice; w: number };
        const cands: Cand[] = [];
        const pip = (cur: number, max: number) => ({ pips: cur, maxPips: max });

        if (this.slashLevel < SLASH_LEVELS.length) {
            const nl = SLASH_LEVELS[this.slashLevel];
            cands.push({
                w: 3, c: {
                    id: 'slash', icon: this.icon('slash'), name: 'FYRESTEEL GREATAXE',
                    detail: `Level ${this.slashLevel + 1}: ${nl.arcDeg}\u00B0 slash arc, ${Math.round(nl.reach)} reach, ${nl.dmg} dmg${nl.backswing && !SLASH_LEVELS[this.slashLevel - 1].backswing ? ', backswing hit' : ''}`,
                    ...pip(this.slashLevel, SLASH_LEVELS.length), isNew: false,
                }
            });
        }
        if (this.novaLevel === 0) {
            cands.push({
                w: 2.4, c: {
                    id: 'nova', icon: this.icon('ring'), name: 'RUNIC FIRE NOVA',
                    detail: 'New weapon: a burst of magmic fire burns everything around you',
                    ...pip(0, NOVA_LEVELS.length), isNew: true,
                }
            });
        } else if (this.novaLevel < NOVA_LEVELS.length) {
            const nl = NOVA_LEVELS[this.novaLevel];
            cands.push({
                w: 3, c: {
                    id: 'nova', icon: this.icon('ring'), name: 'RUNIC FIRE NOVA',
                    detail: `Level ${this.novaLevel + 1}: ${Math.round(nl.radius)} range, ${nl.dmg} dmg, ${nl.cd}s cooldown`,
                    ...pip(this.novaLevel, NOVA_LEVELS.length), isNew: false,
                }
            });
        }
        const passives: Array<[string, string, FrameKey, string]> = [
            ['might', 'RUNES OF GRIMNIR', 'hero_d0', '+15% damage to all attacks'],
            ['swift', 'SWIFTFOOT RUNE', 'hero_s0', '+10% movement speed'],
            ['heart', 'AURIC HEART', 'heart', '+25 max HP and regenerate'],
            ['lure', 'WARPSTONE LURE', 'gemm', '+40% warpstone pickup range'],
        ];
        for (const [id, name, iconKey, detail] of passives) {
            const cur = (this as any)[id] as number;
            if (cur < PASSIVE_MAX) {
                cands.push({
                    w: 2, c: {
                        id, icon: this.icon(iconKey), name, detail,
                        ...pip(cur, PASSIVE_MAX), isNew: false,
                    }
                });
            }
        }

        if (cands.length === 0) {
            return [{
                id: 'heal', icon: this.icon('heart'), name: 'AURIC FEAST',
                detail: 'Restore 50 health', pips: 0, maxPips: 0, isNew: false,
            }];
        }
        // weighted pick 3 distinct
        const out: UpgradeChoice[] = [];
        while (out.length < Math.min(3, cands.length)) {
            const total = cands.reduce((s, c) => s + c.w, 0);
            let r = Math.random() * total;
            let idx = 0;
            for (let i = 0; i < cands.length; i++) { r -= cands[i].w; if (r <= 0) { idx = i; break; } }
            out.push(cands[idx].c);
            cands.splice(idx, 1);
        }
        return out;
    }

    private applyChoice(id: string): void {
        switch (id) {
            case 'slash': this.slashLevel = Math.min(SLASH_LEVELS.length, this.slashLevel + 1); break;
            case 'nova':
                if (this.novaLevel === 0) this.novaCd = 1.2;
                this.novaLevel = Math.min(NOVA_LEVELS.length, this.novaLevel + 1);
                break;
            case 'might': this.might++; break;
            case 'swift': this.swift++; break;
            case 'heart':
                this.heart++; this.maxHp += 25; this.hp = Math.min(this.maxHp, this.hp + 25);
                break;
            case 'lure': this.lure++; break;
            case 'heal': this.hp = Math.min(this.maxHp, this.hp + 50); break;
        }
    }

    // ------------------------------------------------------------------ fx

    private spawnPuff(x: number, y: number, diameter: number): void {
        this.spawnFx('puff', x, y, (Math.random() - 0.5) * 10, 14, 0.4, diameter);
    }

    private spawnFx(kind: 'puff' | 'ember', x: number, y: number, vx: number, vy: number, dur: number, scale = 1): void {
        let f = this.fx.find((ff) => !ff.active);
        if (!f) {
            if (this.fx.length >= 160) return;
            f = { kind, x, y, vx, vy, t: 0, dur, scale, active: false, entity: null };
            this.fx.push(f);
        }
        f.kind = kind; f.x = x; f.y = y; f.vx = vx; f.vy = vy; f.t = 0; f.dur = dur; f.scale = scale; f.active = true;
        f.entity = this.acquire();
        const key: FrameKey = kind === 'puff' ? 'puff0' : 'ember';
        const size = this.lib.size(key);
        this.lib.applyFrame(f.entity, key, kind === 'ember' ? 1 : scale * 0.75 / Math.max(size.w, size.h));
        if (kind === 'ember') f.entity.render!.material = this.emberMat;
        else f.entity.render!.material = this.lib.materials.get('puff0')!;
        f.entity.setPosition(x, y, this.zOf(y) + 4);
    }

    private emberMat: pc.StandardMaterial;

    private updateFx(dt: number): void {
        for (const f of this.fx) {
            if (!f.active) continue;
            f.t += dt;
            if (f.t >= f.dur) {
                f.active = false;
                if (f.entity) { this.release(f.entity); f.entity = null; }
                continue;
            }
            f.x += f.vx * dt; f.y += f.vy * dt;
            if (f.kind === 'ember') f.vy -= 60 * dt;
            const k = f.t / f.dur;
            const key: FrameKey = f.kind === 'puff' ? (k < 0.5 ? 'puff0' : 'puff1') : 'ember';
            const size = this.lib.size(key);
            const scale = f.kind === 'puff' ? f.scale * (0.75 + k * 0.35) / Math.max(size.w, size.h) : Math.max(0.15, 1 - k);
            this.lib.applyFrame(f.entity!, key, scale);
            if (f.kind === 'ember') f.entity!.render!.material = this.emberMat;
            f.entity!.setPosition(f.x, f.y, this.zOf(f.y) + 4);
        }

        for (const r of this.rings) {
            if (!r.active) continue;
            r.t += dt;
            const k = r.t / r.dur;
            if (k >= 1) {
                r.active = false;
                r.entity.enabled = false;
                continue;
            }
            const s = (0.15 + k * 0.95) * (r.radius * 2) / 48; // ring frame is 48px
            r.entity.setLocalScale(s * 48, 1, s * 48);
            r.mat.opacity = 1 - k;
        }

        for (const s of this.slashes) {
            if (!s.active) continue;
            s.t += dt;
            const k = s.t / s.dur;
            if (k >= 1) {
                s.active = false;
                s.entity.enabled = false;
                continue;
            }
            const size = s.size * (0.96 + k * 0.08);
            s.entity.setPosition(s.x, s.y, this.zOf(s.y) + 3);
            s.entity.setLocalScale(size, 1, size);
            s.entity.setLocalRotation(billboardQuatSafe(s.angle + (k - 0.5) * 16, q));
            s.mat.opacity = 1 - k;
        }
    }

    // ------------------------------------------------------------------ camera

    private zOf(y: number): number {
        return -y * 0.05;
    }

    private updateCamera(dt: number, snap: boolean): void {
        const tx = this.hx, ty = this.hy + 12;
        if (snap) { this.camX = tx; this.camY = ty; }
        else {
            const a = 1 - Math.exp(-6 * dt);
            this.camX += (tx - this.camX) * a;
            this.camY += (ty - this.camY) * a;
        }
        this.camera.setPosition(this.camX, this.camY, 100);
    }
}

function billboardQuatSafe(angleDeg: number, out: pc.Quat): pc.Quat {
    const AXIS_Z = new pc.Vec3(0, 0, 1);
    const spin = new pc.Quat().setFromAxisAngle(AXIS_Z, angleDeg);
    const face = new pc.Quat().setFromAxisAngle(pc.Vec3.RIGHT, -90);
    return out.copy(spin).mul(face);
}
