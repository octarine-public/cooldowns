These PNGs are the original `hud_healthbar_status_silenced` sprites extracted
without redrawing from Dota 2's `materials/vgui/hud/health_sheet/` textures:

- `silenced-en.png`: `healthbar_sheet.vtex_c`, sequence 58 (160 × 30).
- `silenced-ru.png`: `healthbar_sheet_russian.vtex_c`, sequence 56 (205 × 30).
- `silenced-cn.png`: `healthbar_sheet_schinese.vtex_c`, sequence 56 (126 × 30).

Extracted from the installed game on 2026-09-13 using Source 2 Viewer 20.0.
The preview displays them at half the asset size, scaled by `GUIInfo.ScaleHeight`.

The `art/` folder holds the icons the preview's sample spells, items and modifiers are drawn
with, downloaded unchanged on 2026-09-17 from the Steam CDN:

- abilities, 128 × 128: `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities/<name>.png`
- items, 88 × 64: `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/<name>.png`

The preview draws its own files rather than the game's textures because the host cuts a sized
copy of a game texture from what the engine holds of it, and the engine streams a texture in
only for what it shows itself: a copy cut for the preview came out as a blot of the icon's
average colour whenever the game had no use for the texture at the time.

The preview now reads complete pixels from these PNGs or, for other heroes, from the installed
game texture named by the ability metadata. It registers full-colour PNG copies with the host
and waits for them to be ready before displaying them. Selecting another hero does not require
adding its ability images to this folder or downloading anything at runtime.

`missing.png` is a local question-mark placeholder for pending, missing or unsupported images.
Failed loads retry after five seconds. The icon cache retains at most 128 recently used copies
and releases older image blobs. Regression tests cover the bundled files, full-colour texture
decoding, texture aliases, readiness, retries and cache eviction.

Rounded icons are centre-cropped to their displayed size and carry antialiased corner coverage
in their alpha channel. Filtering uses premultiplied colours to avoid fringes around transparent
art. The image container stays rectangular so a hard rounded clip cannot erase that smoothing.
The mana wash uses the same coverage. Cached copies are reused and released with their source;
at most two new copies are prepared per canvas frame, with the visible original retained until
the host reports the rounded copy ready. Older hosts retain the geometry-clip fallback.

Icons do not use per-icon shader masks, which require additional compositing render targets.
Tests check the actual alpha pixels, item cropping, upload readiness, retries, cleanup, cooldown
changes, moving rows, item reentry and shape changes.
