# ASSET_PROMPTS — промпты для генерации пиксель-арта

Сгенерированный набор ImageGen от 2026-10-13 сохранён в `assets/generated/`:
`originals/` — исходные изображения (персонажи целыми листами), `frames-hd/` —
36 отдельных кадров в исходном разрешении, `frames/` — игровые размеры.
`prompts.json` и `slash-prompt.txt` содержат использованные промпты.
Последующие исправления сохранены в `walk-prompts.json`, `hero-down-prompt.txt`
и `slash-v2-prompt.txt`: читаемые шаги, неизменная рука с топором и правильная дуга.
Игра теперь предпочитает `spritesheet-hd.png` (1536×1344, ячейки 192×192):
текстуры в 4 раза детальнее, при неизменных размерах объектов в мире.
Готовые HD-кадры — `frames-game-hd/`, исходные крупные кадры — `frames-hd/`.
Повторная нарезка и сборка: `python3 tools/build_generated_sheet.py` (Pillow).
Новый `assets/generated/spritesheet.png` использует **ячейки 48×48** и 8 колонок,
чтобы кольцо 48×48 не перекрывало соседей. Первые 23 слота соответствуют таблице
ниже; слоты 23–34 — `hero_ad0..3`, `hero_au0..3`, `hero_as0..3` (24×24): замах,
удар, завершение, возврат; направления вниз, вверх, вправо. Влево — зеркало.
Исходный лист атаки — `originals/hero_attack_sheet.png`, сетка 4×3.
В слоты 35–50 добавлены `rat_a0..3`, `sv_a0..3`, `monk_a0..3`, `ogre_a0..3`:
по четыре фазы ближней атаки каждому виду. Элитные штормвермины используют `sv_a`.
Размеры кадров — 24×24, у огра 36×32 (в HD-атласе вчетверо больше).
Промпты: `enemy-attack-prompts.json`; исходники: `originals/*_attack.png`.
Итого: 51 кадр атласа и дополнительный отдельный топор, 52 HD-кадра.
Этот атлас автоматически загружается игрой; прежний лист ниже остаётся резервным.
Земля переработана в `src/art.ts`: единое поле 1024×1024, широкие пятна золы,
вытертая тропа, редкие группы сланца и приглушённые трещины. Сгенерированный
`ground.png` сохранён, но не подключён из-за контрастности и заметного повторения.
Метательный топор из первоначального задания сохранён
отдельно как `frames/axe.png` и `frames-hd/axe.png`; текущая игра использует `slash`.

Игра по умолчанию использует бесплатный арт с OpenGameArt (см. `ATTRIBUTION.md`)
и процедурный фолбэк-арт, нарисованный кодом. Этот файл — набор промптов, чтобы
сгенерировать **единый по стилю** сеттинговый арт (Age of Sigmar: Fyreslayer против
скавенов) в любом генераторе изображений (Nano Banana / Midjourney / SDXL + pixel-art LoRA),
а затем собрать `assets/spritesheet.png`.

Генерируйте промптами на английском (генераторы понимают их лучше).

---

## 1. Общий стиль (добавляйте к каждому промпту)

```
16x16 pixel art sprite, top-down 3/4 view (slightly angled, like Vampire Survivors),
dark fantasy, limited palette of ~14 colors on transparent background,
chunky readable silhouette with 1px dark outline, crisp pixels, no anti-aliasing,
no gradients, game asset sprite sheet frame
```

**Negative prompt (если поддерживается):**
```
blurry, smooth shading, 3D render, photorealistic, text, watermark,
more than 20 colors, JPEG artifacts, mixed resolution
```

Палитра-ориентир (hex): outline `#18110b`, кожа `#d99a6c`, огонь `#ffe86b/#ffb52e/#ff5f1c`,
золото `#f7c948`, мех `#7b5a3e/#57402c`, варпстоун `#4dff88/#1f9e4d`, кровь `#c22323`,
броня `#3a4254`, сталь `#b8c0c8`.

---

## 2. Герой — Duardin Fyreslayer (6 кадров)

Fyreslayer: голый торс с выжженными золотыми рунами, огненный ирокез-хохолок
(волосы как расплавленная лава), большая рыжая борода, штаны из шкур, метательный топор.

```
A bare-chested duardin dwarf warrior, fiery orange molten lava mohawk crest,
huge fiery red beard, glowing golden runes branded on skin and chest,
fur trousers, heavy boots, resting a steel greataxe on the shoulder.
Three poses, two walk frames each: facing camera (down), facing away (up),
facing right (side). 16x16 pixel art, top-down 3/4 view, dark fantasy.
```

Кадры: `hero_d0/d1` (вниз), `hero_u0/u1` (вверх), `hero_s0/s1` (вправо; влево — зеркало).

## 3. Скавены (8 кадров)

**Кланрэт (базовый враг):**
```
A hunched skaven rat-man, brown fur, ragged dirty cloth, rusty short sword,
red beady eyes, long pink tail. Side view facing right, two walk frames.
16x16 pixel art, top-down 3/4 view, dark fantasy.
```

**Штормвермин (бронированный):**
```
An armored skaven rat-man warrior, black fur, dark blue-gray plate armor,
halberd with steel blade, red eyes. Side view facing right, two walk frames.
16x16 pixel art, top-down 3/4 view, dark fantasy.
```

**Чумной монах:**
```
A plague monk skaven, hunched in a torn sickly green hooded robe,
green-tinted fur, claws, small brass bell amulet, red eyes.
Side view facing right, two walk frames. 16x16 pixel art, dark fantasy.
```

**Крысиный огр (босс, 26x24):**
```
A huge rat ogre monster, mass of brown fur with pink scarred muscle patches,
broken chains on wrists, stubby horns, crazed red eyes, hunched quadruped stance.
Side view facing right, two walk frames. 26x24 pixel art, dark fantasy.
```

Кадры: `rat0/1`, `sv0/1`, `monk0/1`, `ogre0/1`.

## 4. Предметы и эффекты

```
A small glowing green warpstone shard (XP gem), kite/crystal shape, 16x16.   -> gems / gemm / geml (3 размера)
A red pixel-art heart pickup, 16x16.                                        -> heart
A melee slash crescent arc of orange-white fire, thick chunky pixels,
opening to the right, 32x32.                                                -> slash
A circular burst of orange fire ring, thick chunky pixels, 48x48.           -> ring
Two frames of gray smoke puff, 20x20 and 26x26.                             -> puff0 / puff1
A tiny orange-yellow ember spark, 4x4.                                      -> ember
```

## 5. Земля (опционально)

```
Seamless 64x64 dark cave floor tile, packed brown-black earth, scattered gray
stones, bone fragments, thin glowing orange magma cracks, pixel art, dark fantasy.
```

---

## 6. Как собрать `assets/spritesheet.png`

Лист: **8 колонок × N строк, ячейка 32×32**, порядок кадров:

| # | кадр | размер | # | кадр | размер |
|---|------|--------|---|------|--------|
| 0 | hero_d0 | 16×16 | 12 | ogre0 | 26×24 |
| 1 | hero_d1 | 16×16 | 13 | ogre1 | 26×24 |
| 2 | hero_u0 | 16×16 | 14 | gems | 16×16 |
| 3 | hero_u1 | 16×16 | 15 | gemm | 16×16 |
| 4 | hero_s0 | 16×16 | 16 | geml | 16×16 |
| 5 | hero_s1 | 16×16 | 17 | heart | 16×16 |
| 6 | rat0 | 16×16 | 18 | slash | 32×32 |
| 7 | rat1 | 16×16 | 19 | ring | 48×48 |
| 8 | sv0 | 16×16 | 20 | puff0 | 20×20 |
| 9 | sv1 | 16×16 | 21 | puff1 | 26×26 |
| 10 | monk0 | 16×16 | 22 | ember | 4×4 |
| 11 | monk1 | 16×16 | | | |

Каждый спрайт рисуется **в левом верхнем углу своей ячейки** ровно в своём размере.
Пустые ячейки игнорируются — для них останется текущий арт.
Положите файл в `assets/spritesheet.png` и перезагрузите страницу.

Совет: генерируйте каждый кадр отдельным изображением, приводите к размеру
nearest-neighbour (Pillow: `Image.NEAREST`) и собирайте скриптом по образцу
`tools/build_alt_sheet.py`.
