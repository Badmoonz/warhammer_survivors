/**
 * ui.ts — DOM overlay: HUD, start screen, level-up modal, game over.
 * English UI (genre convention, Press Start 2P has no Cyrillic).
 */

export interface HudState {
    hp: number; maxHp: number; hpRegen: number;
    xp: number; xpNext: number; level: number;
    time: number; kills: number;
    might: number; swift: number;
}

export interface UpgradeChoice {
    id: string;
    icon: HTMLCanvasElement;   // small canvas crop of the sprite
    name: string;
    detail: string;
    pips: number;              // current level dots
    maxPips: number;
    isNew: boolean;
}

export class UI {
    private xpFill: HTMLElement;
    private lvlEl: HTMLElement;
    private timerEl: HTMLElement;
    private killsEl: HTMLElement;
    private hpFill: HTMLElement;
    private hpText: HTMLElement;
    private statsEl: HTMLElement;
    private bannerEl: HTMLElement;
    private vignetteEl: HTMLElement;
    private modal: HTMLElement;
    private bannerTimer: number | null = null;

    constructor() {
        this.xpFill = document.getElementById('xpfill')!;
        this.lvlEl = document.getElementById('lvl')!;
        this.timerEl = document.getElementById('timer')!;
        this.killsEl = document.getElementById('kills')!;
        this.hpFill = document.getElementById('hpfill')!;
        this.hpText = document.getElementById('hptext')!;
        this.statsEl = document.getElementById('stats')!;
        this.bannerEl = document.getElementById('banner')!;
        this.vignetteEl = document.getElementById('vignette')!;
        this.modal = document.getElementById('modal')!;
    }

    updateHUD(s: HudState): void {
        this.xpFill.style.width = `${Math.min(100, (s.xp / s.xpNext) * 100)}%`;
        this.lvlEl.textContent = `LV ${s.level}`;
        const m = Math.floor(s.time / 60), sec = Math.floor(s.time % 60);
        this.timerEl.textContent = `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
        this.killsEl.textContent = `${s.kills} DEAD`;
        const hpPct = Math.max(0, (s.hp / s.maxHp) * 100);
        this.hpFill.style.width = `${hpPct}%`;
        this.hpText.textContent = `${Math.ceil(s.hp)}/${Math.round(s.maxHp)}`;
        this.statsEl.textContent = `MIGHT +${Math.round(s.might * 100)}%  SWIFT +${Math.round(s.swift * 100)}%`;
    }

    banner(text: string, ms = 2600): void {
        this.bannerEl.textContent = text;
        this.bannerEl.classList.remove('hidden');
        this.bannerEl.classList.remove('banner-anim');
        void this.bannerEl.offsetWidth; // restart css animation
        this.bannerEl.classList.add('banner-anim');
        if (this.bannerTimer) window.clearTimeout(this.bannerTimer);
        this.bannerTimer = window.setTimeout(() => this.bannerEl.classList.add('hidden'), ms);
    }

    damageFlash(): void {
        this.vignetteEl.classList.remove('hit');
        void this.vignetteEl.offsetWidth;
        this.vignetteEl.classList.add('hit');
    }

    hideModal(): void {
        this.modal.classList.add('hidden');
        this.modal.innerHTML = '';
    }

    showStart(onStart: () => void): void {
        this.modal.classList.remove('hidden');
        this.modal.innerHTML = `
        <div class="panel">
            <h1>FYRESLAYER</h1>
            <h2>SKAVEN TIDE</h2>
            <p class="sub">a survivors-like MVP - Age of Sigmar fan setting</p>
            <div class="controls">
                <p>WASD / ARROWS - MOVE</p>
                <p>WEAPONS FIRE AUTOMATICALLY</p>
                <p>COLLECT WARPSTONE - LEVEL UP - CHOOSE RUNES</p>
                <p>SURVIVE 5 MINUTES</p>
            </div>
            <button class="big" id="btn-start">ENTER THE TUNNELS</button>
        </div>`;
        const go = () => { this.hideModal(); onStart(); };
        document.getElementById('btn-start')!.addEventListener('click', go);
        const onKey = (ev: KeyboardEvent) => {
            if (ev.code === 'Enter' || ev.code === 'Space' || ev.code === 'NumpadEnter') {
                window.removeEventListener('keydown', onKey);
                go();
            }
        };
        window.addEventListener('keydown', onKey);
    }

    showLevelUp(choices: UpgradeChoice[], onPick: (c: UpgradeChoice) => void): void {
        this.modal.classList.remove('hidden');
        const cards = choices.map((c, i) => `
            <button class="card" data-i="${i}">
                <span class="key">${i + 1}</span>
                <img class="icon" alt="" src="${c.icon.toDataURL()}">
                <h3>${c.name}${c.isNew ? ' <em class="new">NEW!</em>' : ''}</h3>
                <p>${c.detail}</p>
                <span class="pips">${pipsHtml(c.pips, c.maxPips)}</span>
            </button>`).join('');
        this.modal.innerHTML = `
        <div class="panel levelup">
            <h2 class="gold">UR-GOLD RESONANCE</h2>
            <p class="sub">choose a blessing</p>
            <div class="cards">${cards}</div>
        </div>`;
        const pick = (i: number) => {
            if (i < 0 || i >= choices.length) return;
            this.hideModal();
            window.removeEventListener('keydown', onKey);
            onPick(choices[i]);
        };
        this.modal.querySelectorAll('.card').forEach((el) => {
            el.addEventListener('click', () => pick(Number((el as HTMLElement).dataset.i)));
        });
        const onKey = (ev: KeyboardEvent) => {
            if (ev.code === 'Digit1' || ev.code === 'Numpad1') pick(0);
            if (ev.code === 'Digit2' || ev.code === 'Numpad2') pick(1);
            if (ev.code === 'Digit3' || ev.code === 'Numpad3') pick(2);
        };
        window.addEventListener('keydown', onKey);
    }

    showGameOver(s: HudState): void {
        this.modal.classList.remove('hidden');
        this.modal.innerHTML = `
        <div class="panel">
            <h1 class="red">SLAIN</h1>
            <p class="sub">the skaven tide consumes you</p>
            <div class="stats-grid">
                <div><span>TIME</span><b>${fmtTime(s.time)}</b></div>
                <div><span>LEVEL</span><b>${s.level}</b></div>
                <div><span>SKAVEN SLAIN</span><b>${s.kills}</b></div>
            </div>
            <button class="big" id="btn-restart">FIGHT AGAIN (R)</button>
        </div>`;
        document.getElementById('btn-restart')!.addEventListener('click', () => location.reload());
        window.addEventListener('keydown', (ev) => { if (ev.code === 'KeyR') location.reload(); }, { once: true });
    }

    showVictory(s: HudState, onContinue: () => void): void {
        this.modal.classList.remove('hidden');
        this.modal.innerHTML = `
        <div class="panel">
            <h1 class="gold">THE TIDE BREAKS</h1>
            <p class="sub">Grimnir's fury holds the tunnel - 5 minutes survived</p>
            <div class="stats-grid">
                <div><span>LEVEL</span><b>${s.level}</b></div>
                <div><span>SKAVEN SLAIN</span><b>${s.kills}</b></div>
            </div>
            <button class="big" id="btn-cont">KEEP FIGHTING</button>
            <button class="big ghost" id="btn-restart">RESTART (R)</button>
        </div>`;
        document.getElementById('btn-cont')!.addEventListener('click', () => { this.hideModal(); onContinue(); });
        document.getElementById('btn-restart')!.addEventListener('click', () => location.reload());
        window.addEventListener('keydown', (ev) => { if (ev.code === 'KeyR') location.reload(); }, { once: true });
    }
}

function pipsHtml(cur: number, max: number): string {
    let s = '';
    for (let i = 0; i < max; i++) s += `<i class="${i < cur ? 'on' : ''}"></i>`;
    return s;
}

function fmtTime(t: number): string {
    const m = Math.floor(t / 60), sec = Math.floor(t % 60);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
