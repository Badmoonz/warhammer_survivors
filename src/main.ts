/**
 * main.ts — PlayCanvas bootstrap for FYRESLAYER: SKAVEN TIDE.
 *
 * Debug flags (URL params):
 *   ?sheet=1   — show the generated sprite atlas instead of the game
 *   ?bot=1     — simple autopilot (no keyboard needed)
 *   ?god=1     — invulnerable hero
 *   ?t=<sec>   — start the run at a given elapsed time
 */
import * as pc from 'playcanvas';
import { buildArt, FrameKey } from './art';
import { SpriteLib } from './textures';
import { Game, VIEW_H } from './game';
import { UI } from './ui';

async function main(): Promise<void> {
    const params = new URLSearchParams(location.search);

    if (params.get('sheet') === '1') {
        await showSheet();
        return;
    }

    const canvas = document.getElementById('app') as HTMLCanvasElement;
    const app = new pc.Application(canvas, {
        keyboard: new pc.Keyboard(window)
    });
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    window.addEventListener('resize', () => app.resizeCanvas());

    const art = buildArt();
    await applyExternalArt(art);
    const lib = new SpriteLib(app, art);

    // camera: orthographic, XY plane, painter-sorted billboards
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        projection: pc.PROJECTION_ORTHOGRAPHIC,
        orthoHeight: VIEW_H / 2,
        nearClip: 1,
        farClip: 500,
        clearColor: new pc.Color(0.04, 0.027, 0.02, 1),
        clearColorBuffer: true
    });
    app.root.addChild(camera);

    // ground: one arena-wide texture, with no repeated floor tiles
    const ground = new pc.Entity('ground');
    ground.addComponent('render', {
        type: 'plane',
        material: lib.groundMaterial,
        castShadows: false
    });
    ground.setLocalEulerAngles(-90, 0, 0);
    ground.setLocalScale(1024, 1, 1024);
    ground.setPosition(0, 0, -60);
    app.root.addChild(ground);

    const ui = new UI();
    const game = new Game(app, lib, ui, camera);
    (window as any).__game = game; // console debug hook

    app.on('update', (dt: number) => game.update(dt));
    app.start();
}

/**
 * Optional: replace procedural frames with a hand-made / generated sheet.
 * Layout: 8 columns of 48x48 cells (32x32 for the legacy sheet), frames in
 * the order listed below, sprite drawn into the top-left of its cell.
 */
const SHEET_FRAME_ORDER: FrameKey[] = [
    'hero_d0', 'hero_d1', 'hero_u0', 'hero_u1', 'hero_s0', 'hero_s1',
    'rat0', 'rat1', 'sv0', 'sv1', 'monk0', 'monk1', 'ogre0', 'ogre1',
    'gems', 'gemm', 'geml', 'heart', 'slash', 'ring', 'puff0', 'puff1', 'ember',
    'hero_ad0', 'hero_ad1', 'hero_ad2', 'hero_ad3',
    'hero_au0', 'hero_au1', 'hero_au2', 'hero_au3',
    'hero_as0', 'hero_as1', 'hero_as2', 'hero_as3',
    'rat_a0', 'rat_a1', 'rat_a2', 'rat_a3',
    'sv_a0', 'sv_a1', 'sv_a2', 'sv_a3',
    'monk_a0', 'monk_a1', 'monk_a2', 'monk_a3',
    'ogre_a0', 'ogre_a1', 'ogre_a2', 'ogre_a3'
];
const SHEET_COLS = 8;

async function loadBitmap(url: string): Promise<ImageBitmap | null> {
    try {
        const res = await fetch(url);
        return res.ok ? await createImageBitmap(await res.blob()) : null;
    } catch {
        return null;
    }
}

async function applyExternalArt(art: ReturnType<typeof buildArt>): Promise<void> {
    for (const [url, cell, resolution] of [
        [new URL('../assets/generated/spritesheet-hd.png', import.meta.url).href, 192, 4],
        [new URL('../assets/generated/spritesheet.png', import.meta.url).href, 48, 1],
        [new URL('../assets/spritesheet.png', import.meta.url).href, 32, 1]
    ] as const) {
        const img = await loadBitmap(url);
        if (!img) continue;
        try {
            const tmp = document.createElement('canvas');
            const ctx = tmp.getContext('2d')!;
            let applied = 0;
            for (let i = 0; i < SHEET_FRAME_ORDER.length; i++) {
                if (cell === 32 && i >= 23) break; // legacy sheet has no attack frames
                if (cell === 32 && i === 18) continue; // legacy slot 18 is a thrown axe
                const key = SHEET_FRAME_ORDER[i];
                const cx = (i % SHEET_COLS) * cell;
                const cy = Math.floor(i / SHEET_COLS) * cell;
                const frame = art.frames[key];
                const width = frame.w * resolution, height = frame.h * resolution;
                tmp.width = width; tmp.height = height;
                ctx.clearRect(0, 0, width, height);
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(img, cx, cy, width, height, 0, 0, width, height);
                // skip empty cells: keep procedural art for frames the sheet omits
                const data = ctx.getImageData(0, 0, width, height).data;
                let hasPixels = false;
                for (let p = 3; p < data.length; p += 4) {
                    if (data[p] > 0) { hasPixels = true; break; }
                }
                if (!hasPixels) continue;
                // Canvas pixels can increase independently of logical/world dimensions.
                frame.canvas.width = width; frame.canvas.height = height;
                const dst = frame.canvas.getContext('2d')!;
                dst.drawImage(tmp, 0, 0);
                applied++;
            }
            console.log(`[art] external spritesheet applied (${applied} frames, ${resolution}x resolution)`);
        } finally {
            img.close();
        }
        break;
    }

    // Keep the quieter procedural ground; the generated tile is an optional asset.
}

async function showSheet(): Promise<void> {
    const art = buildArt();
    await applyExternalArt(art);
    const wrap = document.createElement('div');
    wrap.className = 'sheet';
    for (const key of Object.keys(art.frames) as FrameKey[]) {
        const f = art.frames[key];
        const cell = document.createElement('div');
        cell.className = 'sheet-cell';
        const img = document.createElement('img');
        img.src = f.canvas.toDataURL();
        img.style.width = `${f.w * 6}px`;
        img.style.imageRendering = 'pixelated';
        const label = document.createElement('span');
        label.textContent = key;
        cell.appendChild(img);
        cell.appendChild(label);
        wrap.appendChild(cell);
    }
    const groundTitle = document.createElement('h2');
    groundTitle.textContent = 'ground preview';
    wrap.appendChild(groundTitle);
    const g = document.createElement('img');
    g.src = art.ground.toDataURL();
    g.style.width = '512px';
    g.style.imageRendering = 'pixelated';
    wrap.appendChild(g);
    document.body.appendChild(wrap);
}

main().catch((err) => {
    console.error(err);
    const el = document.createElement('pre');
    el.style.color = 'red';
    el.textContent = String(err?.stack ?? err);
    document.body.appendChild(el);
});
