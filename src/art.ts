/**
 * art.ts — procedural pixel-art placeholder assets.
 *
 * Every sprite is authored as a char-map (1 char = 1 pixel) with a shared
 * palette, then rasterized onto its own small canvas. When real generated
 * art arrives, drop a matching sheet at assets/spritesheet.png (layout
 * documented in ASSET_PROMPTS.md) — textures.ts swaps it in transparently.
 */

export interface Frame {
    key: string;
    canvas: HTMLCanvasElement;
    w: number;
    h: number;
}

// Shared palette. Chars are matched per-sprite via a char->color map.
const PAL: Record<string, string> = {
    k: '#18110b', // outline
    s: '#d99a6c', // skin
    S: '#a86f4a', // skin shade / nose
    o: '#e2622b', // beard orange
    O: '#a83c1a', // beard dark
    f: '#ffb52e', // flame
    F: '#ff5f1f', // flame hot
    y: '#ffe86b', // flame core
    g: '#f7c948', // gold (ur-gold runes)
    r: '#7b5a3e', // fur brown
    R: '#57402c', // fur dark
    t: '#c9a37a', // fur belly
    n: '#d99a9a', // rat skin (paws/ears/tail)
    E: '#ff3b3b', // glowing red eye
    a: '#3a4254', // armor
    A: '#262c3a', // armor dark
    c: '#b8c0c8', // steel
    C: '#79828e', // steel dark
    h: '#6b4a32', // wood handle
    p: '#5a3b2a', // pants
    b: '#3a2820', // boots
    w: '#4dff88', // warpstone light
    W: '#1f9e4d', // warpstone dark
    x: '#f0e6d2', // bone / white
    e: '#c22323', // blood red
    D: '#2f512c', // plague robe dark
    L: '#4a7c3f', // plague robe
    G: '#777266', // smoke gray
    g2: '#555049', // smoke dark (2-char key used via maps below)
};

// 2-char keys can't live inline in maps; map them to single spare chars here.
const ALIAS: Record<string, string> = { q: PAL.g2 };

function colorOf(ch: string): string | null {
    if (ch === '.') return null;
    return ALIAS[ch] ?? PAL[ch] ?? null;
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
}

/** Rasterize char-map rows onto a w*h canvas. Rows are padded/truncated. */
function drawMap(key: string, rows: string[], w: number, h: number): HTMLCanvasElement {
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d')!;
    for (let y = 0; y < Math.min(h, rows.length); y++) {
        const row = rows[y];
        if (row.length !== w) {
            console.warn(`[art] ${key} row ${y} length ${row.length} != ${w}`);
        }
        for (let x = 0; x < Math.min(w, row.length); x++) {
            const col = colorOf(row[x]);
            if (col) {
                ctx.fillStyle = col;
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
    return c;
}

/** Swap chars in rows (cheap crest flicker / tint variants). */
function swap(rows: string[], from: string, to: string): string[] {
    return rows.map((r) => r.split(from).join(to));
}

function legsShift(rows: string[], fromRow: number, dx: number): string[] {
    return rows.map((r, i) => (i >= fromRow ? shiftRow(r, dx) : r));
}

function shiftRow(row: string, dx: number): string {
    if (dx >= 0) return row.slice(dx).padEnd(row.length, '.');
    return row.slice(0, dx).padStart(row.length, '.');
}

// ----------------------------------------------------------------------------
// Hero — Fyreslayer dwarf (bare chest, ur-gold runes, molten crest)
// ----------------------------------------------------------------------------

const HERO_D0 = [
    '......kkkk......',
    '....kkyyffkk....',
    '...kyfffffFfk...',
    '...kfFFFFFFFk...',
    '..kksssssssskk..',
    '.ksskkskkskkssk.',
    '.ksssssSSsssssk.',
    '.ksoksSSSSksosk.',
    '.koookSSSSkoook.',
    '.koooSSSSSSoook.',
    '.koogoooooogook.',
    '..koooooooook...',
    '..kppgppgpppk...',
    '...kpppppppk....',
    '...kbbk.kbbk....',
    '..kbbbk.kbbbk...',
];

const HERO_U0 = [
    '......kkkk......',
    '....kkyyffkk....',
    '...kyfffffFfk...',
    '...kfFFFFFFFk...',
    '...kfFFFFFFFk...',
    '...kksssssskk...',
    '..kssgssssgssk..',
    '..kssgssssgssk..',
    '..kssssssssssk..',
    '..kssssssssssk..',
    '...kssssssssk...',
    '...kppppppppk...',
    '...kppppppppk...',
    '...kpp....ppk...',
    '...kbb....bbk...',
    '..kbbb....bbbk..',
];

const HERO_S0 = [
    '.....kkkkk......',
    '....kyyfffk.....',
    '...kyfffffFk....',
    '...kfFFFFFFk....',
    '...kkssssskk....',
    '..kssskkssok....',
    '..ksssssssook...',
    '..ksossSSosok...',
    '..koosSSSSook...',
    '..koooSSoooook..',
    '...koooogook....',
    '...kppppppk.....',
    '...kppppppk.....',
    '...kpp.kppk.....',
    '...kbb.kbbk.....',
    '..kbbb.kbbbk....',
];

// ----------------------------------------------------------------------------
// Skaven
// ----------------------------------------------------------------------------

const RAT0 = [
    '...........kkk..',
    '.kk.......krrrk.',
    '.kk......krrErk.',
    '..k......krrrrk.',
    '..knnk..krrrrrk.',
    '...knnkkrrrrrCk.',
    '...knnkrrrrrkk..',
    '..krrrrrrrrk....',
    '..krrrrrrrrrk...',
    '...krrrrrrrk....',
    '...krrkkrrk.....',
    '...knk..knk.....',
    '..knnk..knnk....',
];

const SV0 = [
    '............kck.',
    '.kk........kcCk.',
    '.kk.......krrErk',
    '..k.......kRRRk.',
    '..kaak...kRRRRk.',
    '...kaaakRRRRRk..',
    '...kaaakRRRrkk..',
    '..kaaRRRRRRk....',
    '..kaaRRRRRRRk...',
    '...kRRRRRRRk....',
    '...kRRkkRRk.....',
    '...knk..knk.....',
    '..knnk..knnk....',
];

const MONK0 = [
    '.........kkkk...',
    '..kk....kDLLDk..',
    '..kk...kDLLLLDk.',
    '...k...kDLELLDk.',
    '...knk.kDLLDLLk.',
    '....knkDLLLDLLk.',
    '....kDLLLLLLLDk.',
    '...kDLLgLLLLLDk.',
    '...kDLLLgLLLLDk.',
    '....kDDLLLLDDk.',
    '....kDDkkDDk....',
    '....knk..knk....',
    '...knnk..knnk...',
];

// 24x24 boss
const OGRE0 = [
    '....kk..............kk....',
    '...kxck............kcck...',
    '...kcck............kcck...',
    '....kk..kkkkkkkkk...kk....',
    '.......krrrrrrrrrk........',
    '......krrrrrrrrrrrk.......',
    '.....krrnnrrrrrnnrrk......',
    '.....krnnnrrrrrnnnrk......',
    '....krrnnrkkkkkrnnrrk.....',
    '....krrrrkrrEErkrrrrk.....',
    '....krrrrkrrrrkrrrrk......',
    '...krrrrrkrrrrkrrrrrk.....',
    '...krCCrkkrrrrkkrCCrk.....',
    '...kCCk.krrrrrk.kCCk......',
    '...kCk.krrrrrrrk.kCk......',
    '....kkkrrrrrrrrrkkk.......',
    '......krrrrrrrrrk.........',
    '.....krrrkkkkkrrrk........',
    '.....krrk.....krrk........',
    '.....knk.......knk........',
    '....knnk.......knnk.......',
    '....knnk.......knnk.......',
    '...kkkk.........kkkk......',
];

const GEM_S = [
    '....kk....',
    '...kwwk...',
    '..kwxwwk..',
    '..kwwwwk..',
    '...kWwk...',
    '....kk....',
];

const GEM_M = [
    '.....kk.....',
    '...kkwwkk...',
    '..kwxwwwwk..',
    '..kwwwwwwk..',
    '..kwwwwWwk..',
    '...kWwwWk...',
    '....kWWk....',
    '.....kk.....',
];

const GEM_L = [
    '......kk......',
    '....kkwwkk....',
    '...kwxwwwwk...',
    '..kwwxwwwwwk..',
    '..kwwwwwwwWk..',
    '..kwwwwwwWWk..',
    '...kWwwWWWk...',
    '....kWWWWk....',
    '.....kkkk.....',
];

const HEART = [
    '..ee..ee..',
    '.exeeexee.',
    'exxeeexeee',
    'exxeeeeeee',
    '.xeeeeeee.',
    '..xeeeee..',
    '...xeee...',
    '....ee....',
];

// ----------------------------------------------------------------------------
// Procedural frames (ground, ring, slash, puffs, ember)
// ----------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a |= 0; a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function makeGround(size = 1024): HTMLCanvasElement {
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d')!;
    const rnd = mulberry32(1337);
    // One arena-wide field: broad ash/earth patches, never a repeated tile.
    const grid = 16;
    const heights = Array.from({ length: (grid + 1) ** 2 }, () => rnd());
    const smooth = (t: number) => t * t * (3 - 2 * t);
    for (let y = 0; y < size; y += 2) {
        for (let x = 0; x < size; x += 2) {
            const gx = x / size * grid, gy = y / size * grid;
            const ix = Math.floor(gx), iy = Math.floor(gy);
            const tx = smooth(gx - ix), ty = smooth(gy - iy);
            const top = heights[iy * (grid + 1) + ix] * (1 - tx) + heights[iy * (grid + 1) + ix + 1] * tx;
            const bottom = heights[(iy + 1) * (grid + 1) + ix] * (1 - tx) + heights[(iy + 1) * (grid + 1) + ix + 1] * tx;
            const soil = top * (1 - ty) + bottom * ty;
            // A quiet winding strip of worn earth guides the eye through the arena.
            const trailX = size * 0.5 + Math.sin(y / size * 9) * size * 0.085;
            const worn = Math.max(0, 1 - Math.abs(x - trailX) / (size * 0.105));
            const value = Math.round(soil * 8 + worn * 3 + rnd() * 2);
            ctx.fillStyle = `rgb(${24 + value}, ${23 + value}, ${22 + Math.round(value * 0.8)})`;
            ctx.fillRect(x, y, 2, 2);
        }
    }
    // Small clusters of broken slate leave most of the combat floor empty.
    for (let i = 0; i < 42; i++) {
        const cx = rnd() * size, cy = rnd() * size;
        if (Math.hypot(cx - size / 2, cy - size / 2) < size * 0.09) continue;
        const count = 3 + Math.floor(rnd() * 7);
        for (let j = 0; j < count; j++) {
            const x = Math.floor(cx + (rnd() - 0.5) * 42);
            const y = Math.floor(cy + (rnd() - 0.5) * 30);
            const w = 4 + Math.floor(rnd() * 10), h = 3 + Math.floor(rnd() * 6);
            ctx.fillStyle = '#171819';
            ctx.fillRect(x + 1, y + 2, w, h);
            ctx.fillStyle = rnd() < 0.5 ? '#303235' : '#343434';
            ctx.fillRect(x, y + 1, w, h - 1);
            ctx.fillRect(x + 2, y, w - 3, 1);
            ctx.fillStyle = '#40403e';
            ctx.fillRect(x + 2, y, Math.max(1, w - 5), 1);
        }
    }
    // Sparse grit, deliberately close to the soil luminance.
    for (let i = 0; i < 4200; i++) {
        ctx.fillStyle = rnd() < 0.5 ? '#242524' : '#30312e';
        ctx.fillRect(Math.floor(rnd() * size), Math.floor(rnd() * size), 1 + Math.floor(rnd() * 2), 1);
    }
    // Cold fissures with occasional dim embers, not a bright lava carpet.
    for (let i = 0; i < 28; i++) {
        let x = Math.floor(rnd() * size), y = Math.floor(rnd() * size);
        const dx = rnd() < 0.5 ? -1 : 1;
        const hot = i % 4 === 0;
        const length = 12 + Math.floor(rnd() * 24);
        for (let j = 0; j < length; j++) {
            ctx.fillStyle = '#191819';
            ctx.fillRect(x, y, 2, 2);
            if (hot && rnd() < 0.3) {
                ctx.fillStyle = rnd() < 0.2 ? '#785038' : '#51392e';
                ctx.fillRect(x, y, 1, 1);
            }
            x += dx;
            if (rnd() < 0.5) y += rnd() < 0.5 ? -1 : 1;
        }
    }
    // A few weathered remains add scale without resembling bright pickups.
    for (let i = 0; i < 18; i++) {
        const x = Math.floor(rnd() * size), y = Math.floor(rnd() * size);
        ctx.fillStyle = '#555247';
        ctx.fillRect(x, y, 4, 1);
        ctx.fillRect(x, y - 1, 1, 2);
        ctx.fillRect(x + 3, y, 1, 2);
    }
    const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.34, size / 2, size / 2, size * 0.62);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return c;
}

function makeRing(size = 48, radius = 20): HTMLCanvasElement {
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d')!;
    const rnd = mulberry32(777);
    const cx = size / 2, cy = size / 2;
    for (let a = 0; a < 360; a += 2) {
        const rad = (a * Math.PI) / 180;
        const jitter = (rnd() - 0.5) * 2.5;
        const r = radius + jitter;
        const x = Math.round(cx + Math.cos(rad) * r);
        const y = Math.round(cy + Math.sin(rad) * r);
        const v = rnd();
        ctx.fillStyle = v < 0.3 ? '#ffe86b' : v < 0.7 ? '#ff5f1f' : '#ffb52e';
        ctx.fillRect(x, y, 2, 2);
        if (rnd() < 0.4) {
            ctx.fillStyle = '#c22a10';
            ctx.fillRect(x + 1, y + 1, 2, 1);
        }
    }
    return c;
}

function makePuff(seed: number, radius: number): HTMLCanvasElement {
    const size = radius * 2 + 6;
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d')!;
    const rnd = mulberry32(seed);
    for (let i = 0; i < radius * 7; i++) {
        const a = rnd() * Math.PI * 2;
        const d = rnd() * radius * 0.8;
        const x = Math.round(size / 2 + Math.cos(a) * d);
        const y = Math.round(size / 2 + Math.sin(a) * d);
        const v = rnd();
        ctx.fillStyle = v < 0.4 ? '#777266' : v < 0.75 ? '#555049' : '#9a948a';
        ctx.fillRect(x, y, 2, 2);
    }
    return c;
}

function makeEmber(): HTMLCanvasElement {
    const c = makeCanvas(4, 4);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ff5f1f';
    ctx.fillRect(1, 0, 2, 4);
    ctx.fillRect(0, 1, 4, 2);
    ctx.fillStyle = '#ffe86b';
    ctx.fillRect(1, 1, 2, 2);
    return c;
}

/** Melee slash crescent, opening toward +X (rotated at runtime). */
function makeSlash(size = 32): HTMLCanvasElement {
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d')!;
    const rnd = mulberry32(4242);
    const cx = size / 2, cy = size / 2;
    for (let a = -70; a <= 70; a += 2) {
        const rad = (a * Math.PI) / 180;
        const rMax = 13.5 - Math.abs(a) / 45; // thick at the middle, thin at the tips
        for (let r = 10.5; r <= rMax; r += 0.75) {
            const x = Math.round(cx + Math.cos(rad) * r);
            const y = Math.round(cy + Math.sin(rad) * r);
            const v = rnd();
            const hot = r > rMax - 1 || v < 0.22;
            ctx.fillStyle = hot ? '#ffe86b' : v < 0.68 ? '#ff8c2e' : '#ff5f1f';
            ctx.fillRect(x, y, 1, 1);
        }
    }
    return c;
}

// ----------------------------------------------------------------------------
// Registry
// ----------------------------------------------------------------------------

export type FrameKey =
    | 'hero_d0' | 'hero_d1' | 'hero_u0' | 'hero_u1' | 'hero_s0' | 'hero_s1'
    | 'hero_ad0' | 'hero_ad1' | 'hero_ad2' | 'hero_ad3'
    | 'hero_au0' | 'hero_au1' | 'hero_au2' | 'hero_au3'
    | 'hero_as0' | 'hero_as1' | 'hero_as2' | 'hero_as3'
    | 'rat0' | 'rat1' | 'sv0' | 'sv1' | 'monk0' | 'monk1' | 'ogre0' | 'ogre1'
    | 'rat_a0' | 'rat_a1' | 'rat_a2' | 'rat_a3'
    | 'sv_a0' | 'sv_a1' | 'sv_a2' | 'sv_a3'
    | 'monk_a0' | 'monk_a1' | 'monk_a2' | 'monk_a3'
    | 'ogre_a0' | 'ogre_a1' | 'ogre_a2' | 'ogre_a3'
    | 'gems' | 'gemm' | 'geml' | 'heart' | 'slash' | 'ring' | 'puff0' | 'puff1' | 'ember';

export interface Art {
    frames: Record<FrameKey, Frame>;
    ground: HTMLCanvasElement;
}

export function buildArt(): Art {
    const frames = {} as Record<FrameKey, Frame>;
    const add = (key: FrameKey, rows: string[], w: number, h: number) => {
        frames[key] = { key, canvas: drawMap(key, rows, w, h), w, h };
    };

    // hero walk frame 1: crest flicker + leg shuffle
    const heroD1 = legsShift(swap(HERO_D0, 'y', 'f'), 14, 1);
    const heroU1 = legsShift(swap(HERO_U0, 'y', 'f'), 14, -1);
    const heroS1 = legsShift(swap(HERO_S0, 'f', 'y'), 13, 1);
    add('hero_d0', HERO_D0, 16, 16);
    add('hero_d1', heroD1, 16, 16);
    add('hero_u0', HERO_U0, 16, 16);
    add('hero_u1', heroU1, 16, 16);
    add('hero_s0', HERO_S0, 16, 16);
    add('hero_s1', heroS1, 16, 16);

    // Attack canvases leave four pixels around the original body for the axe.
    for (const direction of ['d', 'u', 's'] as const) {
        for (let phase = 0; phase < 4; phase++) {
            const key = `hero_a${direction}${phase}` as FrameKey;
            const canvas = makeCanvas(24, 24);
            canvas.getContext('2d')!.drawImage(frames[`hero_${direction}0`].canvas, 4, 4);
            frames[key] = { key, canvas, w: 24, h: 24 };
        }
    }

    add('rat0', RAT0, 16, 16);
    add('rat1', legsShift(RAT0, 10, 1), 16, 16);
    add('sv0', SV0, 16, 16);
    add('sv1', legsShift(SV0, 10, -1), 16, 16);
    add('monk0', MONK0, 16, 16);
    add('monk1', legsShift(MONK0, 10, 1), 16, 16);
    add('ogre0', OGRE0, 26, 24);
    add('ogre1', legsShift(OGRE0, 18, 1), 26, 24);

    for (const prefix of ['rat', 'sv', 'monk', 'ogre'] as const) {
        const w = prefix === 'ogre' ? 36 : 24, h = prefix === 'ogre' ? 32 : 24;
        for (let phase = 0; phase < 4; phase++) {
            const key = `${prefix}_a${phase}` as FrameKey;
            const canvas = makeCanvas(w, h);
            canvas.getContext('2d')!.drawImage(frames[`${prefix}0`].canvas, prefix === 'ogre' ? 5 : 4, 4);
            frames[key] = { key, canvas, w, h };
        }
    }

    add('gems', GEM_S, 16, 16);
    add('gemm', GEM_M, 16, 16);
    add('geml', GEM_L, 16, 16);
    add('heart', HEART, 16, 16);

    frames.ring = { key: 'ring', canvas: makeRing(), w: 48, h: 48 };
    frames.slash = { key: 'slash', canvas: makeSlash(), w: 32, h: 32 };
    frames.puff0 = { key: 'puff0', canvas: makePuff(42, 7), w: 20, h: 20 };
    frames.puff1 = { key: 'puff1', canvas: makePuff(99, 10), w: 26, h: 26 };
    frames.ember = { key: 'ember', canvas: makeEmber(), w: 4, h: 4 };

    return { frames, ground: makeGround() };
}
