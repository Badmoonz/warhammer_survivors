/**
 * textures.ts — wraps art canvases into PlayCanvas textures/materials.
 *
 * Rendering model: every sprite is a 1x1 'plane' primitive scaled to the
 * frame's pixel size, rotated -90 deg about X to face the ortho camera
 * (camera looks down -Z, screen-up is +Y). Materials are emissive-only
 * StandardMaterials, i.e. unlit, so pixel colors come out exact.
 */
import * as pc from 'playcanvas';
import { Art, FrameKey } from './art';

export class SpriteLib {
    readonly app: pc.AppBase;
    readonly art: Art;
    readonly textures = new Map<FrameKey, pc.Texture>();
    readonly materials = new Map<FrameKey, pc.StandardMaterial>();
    readonly sizes = new Map<FrameKey, { w: number; h: number }>();
    groundTexture: pc.Texture;
    groundMaterial: pc.StandardMaterial;

    constructor(app: pc.AppBase, art: Art) {
        this.app = app;
        this.art = art;

        for (const key of Object.keys(art.frames) as FrameKey[]) {
            const f = art.frames[key];
            const tex = this.makeTexture(f.canvas);
            this.textures.set(key, tex);
            this.materials.set(key, this.makeMaterial(tex, false));
            this.sizes.set(key, { w: f.w, h: f.h });
        }

        this.groundTexture = this.makeTexture(art.ground);
        this.groundTexture.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
        this.groundTexture.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
        this.groundMaterial = this.makeMaterial(this.groundTexture, false);
    }

    private makeTexture(source: HTMLCanvasElement): pc.Texture {
        const tex = new pc.Texture(this.app.graphicsDevice);
        tex.setSource(source);
        tex.flipY = true; // canvas top row -> v=1 -> screen up on -90X planes
        tex.minFilter = pc.FILTER_NEAREST;
        tex.magFilter = pc.FILTER_NEAREST;
        tex.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
        tex.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
        return tex;
    }

    /** Unlit sprite material: emissive map for color, opacity map for alpha. */
    makeMaterial(tex: pc.Texture, additive: boolean, opacity = 1): pc.StandardMaterial {
        const m = new pc.StandardMaterial();
        m.emissiveMap = tex;
        m.emissive = new pc.Color(1, 1, 1);
        m.diffuse.set(0, 0, 0);
        m.specular.set(0, 0, 0);
        m.useLighting = false;
        m.opacityMap = tex;
        m.opacityMapChannel = 'a';
        m.opacity = opacity;
        m.blendType = additive ? pc.BLEND_ADDITIVE : pc.BLEND_NORMAL;
        m.cull = pc.CULLFACE_NONE;
        m.depthWrite = false;
        m.update();
        return m;
    }

    size(key: FrameKey): { w: number; h: number } {
        return this.sizes.get(key) ?? { w: 16, h: 16 };
    }

    /** Creates a sprite entity (billboard plane, painter-sorted by y later). */
    makeSprite(key: FrameKey, scale = 1): pc.Entity {
        const e = new pc.Entity();
        e.addComponent('render', {
            type: 'plane',
            material: this.materials.get(key)!,
            castShadows: false
        });
        this.applyFrame(e, key, scale);
        e.setLocalEulerAngles(-90, 0, 0);
        return e;
    }

    applyFrame(e: pc.Entity, key: FrameKey, scale = 1, faceLeft = false): void {
        const s = this.size(key);
        e.render!.material = this.materials.get(key)!;
        e.setLocalScale((faceLeft ? -s.w : s.w) * scale, 1, s.h * scale);
    }
}

const AXIS_Z = new pc.Vec3(0, 0, 1);

/** Orientation quaternion: face camera, then spin in screen plane by angle. */
export function billboardQuat(angleDeg: number, out: pc.Quat): pc.Quat {
    const spin = new pc.Quat().setFromAxisAngle(AXIS_Z, angleDeg);
    const face = new pc.Quat().setFromAxisAngle(pc.Vec3.RIGHT, -90);
    return out.copy(spin).mul(face);
}
