// Run the real Game methods with deterministic world and rendering stubs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as pc from 'playcanvas';

const source = fs.readFileSync(new URL('../src/game.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;
const context = vm.createContext({ exports: {}, require: () => pc, URLSearchParams, console, location: { search: '' } });
vm.runInContext(compiled, context);
const { Game } = context.exports;
const cfg = { cd: 1, dmg: 16, reach: 36, arcDeg: 110, backswing: false };
const radians = degrees => degrees * Math.PI / 180;
const enemy = (id, angle, distance = 30, radius = 1) => ({
    id, x: Math.cos(radians(angle)) * distance, y: Math.sin(radians(angle)) * distance,
    radius, hp: 100, kbx: 0, kby: 0, entity: { enabled: true }
});

function world(enemies, facing = 'd') {
    const entity = {
        enabled: false, render: {}, position: [], scale: [], rotation: new pc.Quat(),
        setPosition(...position) { this.position = position; },
        setLocalScale(...scale) { this.scale = scale; },
        setLocalRotation(rotation) { this.rotation.copy(rotation); }
    };
    const game = Object.create(Game.prototype);
    Object.assign(game, {
        hx: 0, hy: 0, facing, faceLeft: false, walkT: 0, hero: {},
        attackT: 0, might: 0, slashCd: 0, slashLevel: 1, slashQueue: [], novaLevel: 0,
        enemies, slashes: [{ active: false, t: 0, dur: 0.16, angle: 0, size: 40, entity, mat: {} }],
        rings: [], fx: [], lib: { applyFrame() {} }, spawnFx() {}
    });
    const hits = [];
    game.damageEnemy = (target, ...damage) => hits.push({ target, damage });
    return { game, hits, entity };
}

const checks = [];
function check(name, test) {
    try { test(); console.log(`PASS: ${name}`); }
    catch (error) { checks.push(name); console.error(`FAIL: ${name}: ${error.message}`); }
}

check('auto attack chooses dense cluster instead of movement facing', () => {
    const { game, hits } = world([enemy(1, 0), enemy(2, 10), enemy(3, 20), enemy(4, -120)]);
    game.updateWeapons(0.01);
    assert.deepEqual(hits.map(hit => hit.target.id), [1, 2, 3]);
});

check('sector between two enemies hits both without aiming at either center', () => {
    const { game, hits } = world([enemy(1, -50), enemy(2, 50)], 'u');
    game.swingSlash(0, 1, cfg);
    assert.equal(hits.length, 2);
});

check('sector wraps around -180/180 degrees', () => {
    const { game, hits } = world([enemy(1, 175), enemy(2, -175), enemy(3, 160)]);
    game.swingSlash(0, -1, cfg);
    assert.equal(hits.length, 3);
});

check('inclusive sector edges, reach+radius, overlap and out of range', () => {
    const { game, hits } = world([
        enemy(1, -55, 37), enemy(2, 55, 37), enemy(3, 0, 0), enemy(4, 0, 37.01)
    ], 's');
    game.swingSlash(1, 0, cfg);
    assert.deepEqual(hits.map(hit => hit.target.id), [1, 2, 3]);
});

check('equal counts retain facing when facing is optimal', () => {
    const { game } = world([enemy(1, -10), enemy(2, 10)], 's');
    game.swingSlash(1, 0, cfg);
    assert.ok(Math.abs(game.slashes[0].angle) < 1e-6);
});

check('left movement only mirrors side-facing walk frames', () => {
    const { game } = world([], 'd');
    const frames = [];
    game.faceLeft = true;
    game.lib.applyFrame = (...args) => frames.push(args);
    for (const facing of ['d', 'u', 's']) {
        game.facing = facing;
        game.applyHeroFrame();
        assert.equal(frames.at(-1)[3], facing === 's', `${facing} mirror`);
    }
});

check('delayed backswing retargets enemies at trigger time', () => {
    const { game, hits } = world([], 'd');
    game.slashCd = 10;
    game.slashLevel = 2;
    game.slashQueue = [{ t: 0.001, dx: 0, dy: -1 }];
    game.enemies = [enemy(1, 0), enemy(2, 15)];
    game.updateWeapons(0.01);
    assert.deepEqual(hits.map(hit => hit.target.id), [1, 2]);
});

check('wave starts at damage origin, matches radius and keeps snapshot origin', () => {
    const { game, entity } = world([enemy(1, 0)], 's');
    game.hx = 12; game.hy = 7;
    game.swingSlash(1, 0, cfg);
    assert.deepEqual(entity.position.slice(0, 2), [12, 7]);
    game.hx = 100; game.hy = 100;
    game.updateFx(0.08);
    assert.deepEqual(entity.position.slice(0, 2), [12, 7]);
    assert.ok(Math.abs(entity.scale[0] * 14 / 32 - cfg.reach) <= cfg.reach * 0.05);
    assert.equal(entity.scale[0], entity.scale[2]);
    const forward = entity.rotation.transformVector(new pc.Vec3(1, 0, 0));
    assert.ok(forward.x > 0.97 && Math.abs(forward.y) < 0.25);
    assert.ok(game.slashes[0].mat.opacity > 0 && game.slashes[0].mat.opacity < 1);
    game.updateFx(0.08);
    assert.equal(entity.enabled, false);
});

check('maximum count matches an independent angular endpoint oracle', () => {
    let seed = 12345;
    const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
    for (let scenario = 0; scenario < 100; scenario++) {
        const targets = Array.from({ length: 20 }, (_, id) => enemy(id, random() * 360 - 180, random() * 60));
        const options = { ...cfg, arcDeg: [110, 120, 140, 170][scenario % 4] };
        const halfArc = radians(options.arcDeg / 2);
        const angles = targets.map(target => Math.atan2(target.y, target.x));
        const candidates = [0, ...angles.flatMap(angle => [angle - halfArc, angle + halfArc])];
        const optimum = Math.max(...candidates.map(aim => targets.filter(target => {
            const distance = Math.hypot(target.x, target.y);
            const angle = Math.atan2(target.y, target.x);
            const turn = Math.abs(Math.atan2(Math.sin(angle - aim), Math.cos(angle - aim)));
            return distance <= options.reach + target.radius + 1e-7
                && (distance < 0.001 || turn <= halfArc + 1e-9);
        }).length));
        const { game, hits } = world(targets, 's');
        game.swingSlash(1, 0, options);
        assert.equal(hits.length, optimum, `scenario ${scenario}`);
    }
});

check('full 300-enemy crowd chooses the exact maximum', () => {
    const { game, hits } = world(Array.from({ length: 300 }, (_, id) => enemy(id, id * 360 / 300)), 's');
    game.swingSlash(1, 0, cfg);
    assert.equal(hits.length, 92);
});

check('empty and out-of-reach swings have no side effects', () => {
    for (const targets of [[], [enemy(1, 0, 100)]]) {
        const { game, hits, entity } = world(targets, 's');
        let frames = 0, sparks = 0;
        game.lib.applyFrame = () => frames++;
        game.spawnFx = () => sparks++;
        const fired = game.swingSlash(1, 0, cfg);
        assert.equal(game.attackT, 0);
        assert.equal(entity.enabled, false);
        assert.equal(frames, 0); assert.equal(sparks, 0); assert.equal(hits.length, 0);
        assert.equal(fired, false);
    }
});

check('empty automatic and queued swings keep cooldown ready and queue nothing', () => {
    const { game, entity } = world([]);
    game.slashLevel = 2;
    game.slashQueue = [{ t: 0.001, dx: 1, dy: 0 }];
    game.updateWeapons(0.01);
    assert.equal(game.slashCd, 0);
    assert.equal(game.slashQueue.length, 0);
    assert.equal(game.attackT, 0);
    assert.equal(entity.enabled, false);
    game.enemies = [enemy(1, 0)];
    game.updateWeapons(0.01);
    assert.equal(game.slashCd, 1);
    assert.equal(game.slashQueue.length, 1);
    assert.ok(game.attackT > 0);
});

check('nova skips targets outside its actual radius and stays ready', () => {
    const { game, hits } = world([enemy(1, 0, 57, 10)]);
    let sparks = 0;
    game.spawnFx = () => sparks++;
    const fired = game.castNova(56, 16, 110);
    assert.equal(sparks, 0); assert.equal(hits.length, 0);
    assert.equal(fired, false);
    game.slashCd = 10; game.novaLevel = 1; game.novaCd = 0;
    game.updateWeapons(0.01);
    assert.equal(game.novaCd, 0);
    assert.equal(sparks, 0);
    game.enemies = [enemy(2, 0, 56)];
    game.updateWeapons(0.01);
    assert.equal(game.novaCd, 4.2);
    assert.equal(hits.length, 1); assert.equal(sparks, 10);
});

check('death puff stays proportional for every kind, scale and walking/attack pose', () => {
    for (const kind of ['clanrat', 'monk', 'stormvermin', 'elite', 'ogre']) {
        for (const scale of [0.5, 1, 1.35, 1.55, 2]) {
            for (const attackT of [0, 0.1]) {
                const width = kind === 'ogre' ? 26 : 16, height = kind === 'ogre' ? 24 : 16;
                const canvasWidth = attackT > 0 ? kind === 'ogre' ? 36 : 24 : width;
                const canvasHeight = attackT > 0 ? kind === 'ogre' ? 32 : 24 : height;
                const renderedScale = scale * 1.14; // include the visible hit flash enlargement
                const diameter = Math.max(width, height) * renderedScale;
                const { game } = world([]);
                game.kills = 0;
                game.release = entity => { entity.enabled = false; };
                game.acquire = () => ({ enabled: true, render: {}, setPosition() {} });
                game.lib.size = key => {
                    if (key.startsWith('puff')) return { w: key === 'puff0' ? 20 : 26, h: key === 'puff0' ? 20 : 26 };
                    const ogre = key.startsWith('ogre'), attack = key.includes('_a');
                    return { w: attack ? ogre ? 36 : 24 : ogre ? 26 : 16, h: attack ? ogre ? 32 : 24 : ogre ? 24 : 16 };
                };
                game.lib.materials = new Map([['puff0', {}]]);
                game.lib.applyFrame = (entity, key, factor) => {
                    entity.diameter = game.lib.size(key).w * factor;
                };
                game.spawnFx = Game.prototype.spawnFx;
                game.killEnemy({ kind, x: 0, y: 0, scale, attackT, entity: {
                    getLocalScale: () => new pc.Vec3(-canvasWidth * renderedScale, 1, canvasHeight * renderedScale)
                } }, true);
                const puff = game.fx[0];
                assert.ok(Math.abs(puff.entity.diameter - diameter * 0.75) < 1e-8, `${kind} initial size`);
                game.updateFx(0.001);
                assert.ok(Math.abs(puff.entity.diameter - diameter * (0.75 + 0.35 * 0.001 / 0.4)) < 1e-8);
                game.updateFx(0.198);
                const before = puff.entity.diameter;
                game.updateFx(0.002);
                assert.ok(Math.abs(puff.entity.diameter - before - diameter * 0.35 * 0.002 / 0.4) < 1e-8, `${kind} frame transition`);
                game.updateFx(0.198);
                assert.ok(puff.entity.diameter <= diameter * 1.1, `${kind} max size`);
            }
        }
    }
});

function spawningWorld(allowElites = false) {
    const lib = {
        textures: new Map(), makeMaterial: () => ({}),
        applyFrame(entity, key, scale = 1, faceLeft = false) {
            entity.render.material = key;
            const attack = key.includes('_a'), ogre = key.startsWith('ogre');
            const width = attack ? ogre ? 36 : 24 : ogre ? 26 : 16;
            const height = attack ? ogre ? 32 : 24 : ogre ? 24 : 16;
            entity.setLocalScale((faceLeft ? -width : width) * scale, 1, height * scale);
        },
        makeSprite(key, scale = 1) {
            const entity = new pc.Entity();
            entity.render = {};
            this.applyFrame(entity, key, scale);
            return entity;
        }
    };
    const root = new pc.Entity();
    root._enabledInHierarchy = true; // matches AppBase's root initialization
    const game = new Game({ root, graphicsDevice: { width: 800, height: 600 } },
        lib, { showStart() {}, banner() {}, damageFlash() {}, showGameOver() {} }, new pc.Entity());
    game.debugGod = true;
    if (!allowElites) game.eliteT = Infinity;
    game.spawnPos = () => ({ x: 0, y: 180 });
    return game;
}

for (const [kind, prefix, damage] of [
    ['clanrat', 'rat', 8], ['monk', 'monk', 10], ['stormvermin', 'sv', 16], ['elite', 'sv', 20], ['ogre', 'ogre', 34]
]) {
    check(`${kind} plays four contact attack phases, freezes facing, resumes walk and preserves damage`, () => {
        const game = spawningWorld();
        game.debugGod = false;
        game.spawnEnemy(kind, -1, 0);
        const target = game.enemies[0];
        target.speed = 0;
        game.updateEnemies(0);
        assert.equal(target.entity.render.material, `${prefix}_a0`);
        assert.equal(game.hp, 100 - damage);
        assert.equal(target.hitCd, 0.55);
        assert.ok(target.entity.getLocalScale().x > 0);
        game.hx = target.x - 1;
        for (const [dt, phase] of [[0.071, 1], [0.07, 2], [0.07, 3]]) {
            game.updateEnemies(dt);
            assert.equal(target.entity.render.material, `${prefix}_a${phase}`);
            assert.ok(target.entity.getLocalScale().x > 0, 'active attack retains original facing');
            assert.equal(game.hp, 100 - damage);
        }
        game.updateEnemies(0.071);
        assert.ok([`${prefix}0`, `${prefix}1`].includes(target.entity.render.material));
        assert.ok(target.entity.getLocalScale().x < 0, 'walking resumes toward the hero');
        assert.equal(target.attackT, 0);
        game.updateEnemies(0.267);
        assert.equal(game.hp, 100 - damage);
        game.updateEnemies(0.002);
        assert.equal(game.hp, 100 - damage * 2);
        assert.equal(target.entity.render.material, `${prefix}_a0`);
        assert.ok(target.entity.getLocalScale().x < 0, 'next attack captures new facing');
    });
}

check('all monster kinds animate against invulnerable hero, but never from afar or disabled entities', () => {
    for (const kind of ['clanrat', 'monk', 'stormvermin', 'elite', 'ogre']) {
        const game = spawningWorld();
        game.spawnEnemy(kind, 1, 0);
        const target = game.enemies[0];
        target.speed = 0;
        game.updateEnemies(0);
        assert.ok(target.attackT > 0);
        assert.ok(target.entity.getLocalScale().x < 0);
        assert.equal(game.hp, 100);
        target.attackT = 0; target.hitCd = 0; target.x = 100;
        game.updateEnemies(0.01);
        assert.equal(target.attackT, 0);
        assert.equal(target.entity.render.material.includes('_a'), false);
        target.x = 1; target.entity.enabled = false;
        game.updateEnemies(0.01);
        assert.equal(target.attackT, 0);
        assert.equal(target.hitCd, 0);
    }
});

check('all sixteen monster attack fallbacks preserve canvas dimensions and centered bodies', () => {
    const canvas = () => {
        const draws = [];
        const ctx = { fillRect() {}, drawImage(...args) { draws.push(args); }, createRadialGradient: () => ({ addColorStop() {} }) };
        return { width: 0, height: 0, draws, getContext: () => ctx };
    };
    const artContext = vm.createContext({ exports: {}, document: { createElement: canvas }, console: { warn() {} } });
    vm.runInContext(ts.transpileModule(fs.readFileSync(new URL('../src/art.ts', import.meta.url), 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
    }).outputText, artContext);
    const art = artContext.exports.buildArt();
    for (const prefix of ['rat', 'sv', 'monk', 'ogre']) {
        for (let phase = 0; phase < 4; phase++) {
            const frame = art.frames[`${prefix}_a${phase}`];
            assert.equal(frame.w, prefix === 'ogre' ? 36 : 24);
            assert.equal(frame.h, prefix === 'ogre' ? 32 : 24);
            assert.equal(frame.canvas.draws[0][0], art.frames[`${prefix}0`].canvas);
            assert.deepEqual(frame.canvas.draws[0].slice(1), [prefix === 'ogre' ? 5 : 4, 4]);
        }
    }
});

check('monsters approach, stop with a gap, attack and never overshoot', () => {
    for (const kind of ['clanrat', 'monk', 'stormvermin', 'elite', 'ogre']) {
        for (const dt of [0.2, 10]) {
            const game = spawningWorld();
            game.spawnEnemy(kind, 30, 0);
            const target = game.enemies[0];
            const stop = target.radius + 5.5 + 3;
            target.speed = 100;
            game.updateEnemies(dt);
            assert.ok(Math.abs(target.x - stop) < 1e-8, `${kind} seek stops at melee gap`);
            assert.ok(target.attackT > 0, `${kind} attacks at the stopping distance`);
            game.updateEnemies(0.01);
            assert.ok(Math.abs(target.x - stop) < 1e-8, `${kind} remains stationary beside hero`);
        }
    }
});

check('initial overlap resolves and outward knockback returns naturally without pulling inward', () => {
    const game = spawningWorld();
    game.spawnEnemy('clanrat', 0, 0);
    const target = game.enemies[0];
    target.speed = 0;
    const stop = target.radius + 5.5 + 3;
    game.updateEnemies(0);
    assert.ok(Math.abs(Math.hypot(target.x, target.y) - stop) < 1e-8);
    const direction = { x: target.x / stop, y: target.y / stop };
    target.kbx = direction.x * 80; target.kby = direction.y * 80;
    game.updateEnemies(0.1);
    assert.ok(Math.hypot(target.x, target.y) > stop + 7.9, 'outward knockback is preserved');
    target.speed = 34;
    for (let frame = 0; frame < 30; frame++) game.updateEnemies(0.1);
    assert.ok(Math.abs(Math.hypot(target.x, target.y) - stop) < 1e-8);
});

check('rat ogre spawns at 150 seconds, next at 225, and walks into view alive', () => {
    const game = spawningWorld();
    assert.equal(game.bossT, 150);
    game.elapsed = 149.99;
    game.updateSpawner(0);
    assert.equal(game.enemies.filter(target => target.kind === 'ogre').length, 0);
    game.elapsed = 150;
    game.updateSpawner(0);
    const first = game.enemies.find(target => target.kind === 'ogre');
    assert.ok(first);
    assert.equal(game.bossT, 225);
    assert.equal(first.entity.enabled, true);
    assert.equal(first.entity.render.material, 'ogre0');
    assert.ok(Math.abs(first.entity.getLocalScale().x - 26 * 1.35) < 1e-8);
    for (let frame = 0; frame < 60; frame++) game.updateEnemies(0.1);
    assert.ok(game.enemies.includes(first));
    assert.ok(first.hp > 0);
    assert.equal(first.entity.enabled, true);
    assert.ok(['ogre0', 'ogre1'].includes(first.entity.render.material));
    assert.ok(Math.abs(first.y) < 130, 'ogre moves into the camera height of 260');
    game.elapsed = 224.99;
    game.updateSpawner(0);
    assert.equal(game.enemies.filter(target => target.kind === 'ogre').length, 1);
    game.elapsed = 225;
    game.updateSpawner(0);
    assert.equal(game.enemies.filter(target => target.kind === 'ogre').length, 2);
    assert.equal(game.bossCount, 2);
    assert.equal(game.bossT, 300);
});

check('rat ogre bypasses the 300-enemy cap and keeps its enabled render entity', () => {
    const game = spawningWorld();
    for (let id = 0; id < 300; id++) game.spawnEnemy('clanrat', 100 + (id % 20) * 16, -440 + Math.floor(id / 20) * 16);
    assert.equal(game.enemies.length, 300);
    game.spawnEnemy('clanrat', 200, 200);
    assert.equal(game.enemies.length, 300);
    game.elapsed = 150;
    game.updateSpawner(0);
    assert.equal(game.enemies.length, 301);
    const boss = game.enemies.find(target => target.kind === 'ogre');
    assert.equal(boss.entity.enabled, true);
    assert.equal(boss.entity.render.material, 'ogre0');
    game.updateEnemies(0.01);
    assert.ok(game.enemies.includes(boss));
    assert.ok(boss.hp > 0);
    assert.equal(boss.entity.enabled, true);
    assert.ok(['ogre0', 'ogre1'].includes(boss.entity.render.material));
});

check('elite appears at 75 seconds and repeats at 115', () => {
    const game = spawningWorld(true);
    assert.equal(game.eliteT, 75);
    game.elapsed = 74.99;
    game.updateSpawner(0);
    assert.equal(game.enemies.filter(target => target.kind === 'elite').length, 0);
    game.elapsed = 75;
    game.updateSpawner(0);
    assert.equal(game.enemies.filter(target => target.kind === 'elite').length, 1);
    assert.equal(game.eliteT, 115);
    game.elapsed = 114.99;
    game.updateSpawner(0);
    assert.equal(game.enemies.filter(target => target.kind === 'elite').length, 1);
    game.elapsed = 115;
    game.updateSpawner(0);
    assert.equal(game.enemies.filter(target => target.kind === 'elite').length, 2);
    assert.equal(game.eliteT, 155);
});

check('victory occurs at 300 seconds, then endless can continue', () => {
    const game = spawningWorld();
    for (const method of ['updateHero', 'updateSpawner', 'updateEnemies', 'updateWeapons', 'updateGems', 'updateFx', 'updateCamera']) game[method] = () => {};
    const victories = [];
    game.ui.updateHUD = () => {};
    game.ui.showVictory = (hud, resume) => victories.push({ hud, resume });
    game.state = 'playing';
    game.elapsed = 299.99;
    game.update(0);
    assert.equal(victories.length, 0);
    game.elapsed = 300;
    game.update(0);
    assert.equal(victories.length, 1);
    assert.equal(game.state, 'victory');
    assert.equal(victories[0].hud.time, 300);
    victories[0].resume();
    assert.equal(game.state, 'playing');
    game.update(0.01);
    assert.equal(victories.length, 1);
});

if (checks.length) process.exitCode = 1;
else console.log('Combat regression checks passed.');
