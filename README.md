# DarkBili TV — Dark Mode for bilibili.tv

A small Chrome (Manifest V3) extension that adds dark mode to
`https://www.bilibili.tv/*`.

## How it works

Rather than hand-writing overrides for every bilibili.tv class name (which
would break the moment the site's frontend changes), this uses the
"smart invert" trick:

1. The whole page gets `filter: invert(1) hue-rotate(180deg)`, which flips
   light backgrounds to dark and dark text to light.
2. Images, videos, thumbnails, avatars, and anything with a CSS
   `background-image` get the filter inverted a second time, so they show
   their real colors instead of looking like a photo negative.

This is the same general approach used by most "instant dark mode"
extensions (including the reference `bilibili-dark-mode` project, though
that one is a full Plasmo build with per-element theming for
bilibili.com specifically). This version is a plain, dependency-free MV3
extension aimed at the `.tv` international site, so no build step is
required — you load the folder as-is.

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

## Customizing

- To scope it to fewer pages, narrow the `matches` / `host_permissions`
  patterns in `manifest.json`.
- To fine-tune specific elements (e.g. make the top nav pure black
  instead of inverted), add targeted rules to `content.css` scoped under
  `html.darkbili-enabled`.
- Contrast and brightness are user-adjustable from the popup and stored
  with `chrome.storage.sync`, so they carry across your signed-in Chrome
  profiles.
