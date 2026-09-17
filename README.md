# DarkBili TV — Dark Mode for bilibili.tv

A small Chrome (Manifest V3) extension that adds dark mode to
`https://www.bilibili.tv/*`.

## How it works

This does **not** use a `filter: invert()` trick — that approach flips
hue too, so pink logos turn cyan, brand colors shift, and anything not
tagged as `<img>`/`<video>` (SVG icons, CSS-drawn elements) gets
color-negatived along with the backgrounds. Instead, `content.js` walks
the actual DOM and, for each element:

1. Reads its **real computed background color**. If it's a solid, light
   color, it converts it to HSL and darkens the *lightness* only — same
   hue and saturation, just dark instead of light. A light pink button
   becomes a dark pink button, not a cyan one.
2. Does the same in reverse for text color: dark text on a
   now-dark background gets lightened.
3. **Skips** anything that isn't a flat color: images, video, canvas,
   SVG icons, and any element using a `background-image` or gradient are
   left completely untouched, so thumbnails, avatars, and the video
   player always show their true colors.
4. Watches the page for new content (bilibili.tv is a single-page app)
   via a `MutationObserver`, so content loaded after the initial page
   load gets themed too.

Turning dark mode off restores every element's original inline style
exactly, rather than just removing a CSS class.

This is a plain, dependency-free MV3 extension aimed at the `.tv`
international site — no build step required, you load the folder as-is.
(The reference `bilibili-dark-mode` project is a full Plasmo build with
hand-tuned selectors for `bilibili.com` specifically; this project takes
a different, site-agnostic approach so it isn't tied to that site's
exact class names.)

## Install (unpacked / developer mode)

1. Unzip this folder somewhere permanent (don't delete it after installing
   — Chrome loads the extension from this folder every time).
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `darkbili-tv` folder.
5. Visit `https://www.bilibili.tv/th/` — the page should load in dark mode.
6. Click the extension's icon in the toolbar to toggle it on/off or adjust
   contrast/brightness.

## Files

- `manifest.json` — MV3 manifest, scoped to `bilibili.tv`
- `content.css` — the invert-based dark theme
- `content.js` — applies the theme and reacts to settings changes
- `popup.html` / `popup.css` / `popup.js` — the toolbar popup UI
- `icons/` — toolbar icon

## Known limitations

- Backgrounds set via a CSS **gradient** (not a flat color) are left
  alone, since safely re-deriving a gradient's colors isn't reliable.
  If you spot a specific panel that's still light because of this, tell
  me its section and I can add a targeted override.
- Very low-opacity overlay colors (under ~40% alpha) are skipped on
  purpose, since they're usually hover/tint layers that look wrong if
  recolored in isolation.

## Customizing

- To scope it to fewer pages, narrow the `matches` / `host_permissions`
  patterns in `manifest.json`.
- To force a specific element to a specific color regardless of the
  engine's decision, add a targeted rule to `content.css` scoped under
  `html.darkbili-enabled` with `!important` (it'll simply win over the
  inline style content.js sets).
- The **Darkness** slider in the popup controls how dark solid
  backgrounds become (target lightness ranges from ~22% at 0 to ~5% at
  100) and is stored with `chrome.storage.sync`, so it carries across
  your signed-in Chrome profiles.
