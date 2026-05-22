# Zoom Skool Video

A minimal Chrome extension that turns any Skool lesson into a theater-mode view: the rest of the page is hidden, the video fills the width of the browser, and the breadcrumb (program name → course → current lesson) is rendered as rotated text along each side. Click the toolbar icon to toggle; click again or press **Esc** to restore the original page.

Works on Skool lessons (Loom embeds), YouTube, Vimeo, and Wistia, with a fallback to the largest iframe on the page.

## Install

### 1. Clone the repo

```sh
git clone <REPO_URL> zoom-skool-video-extension
cd zoom-skool-video-extension
```

> Replace `<REPO_URL>` with the URL of the GitHub repo you're cloning from.

### 2. Load it into Chrome

1. Open `chrome://extensions/` in Chrome.
2. Toggle **Developer mode** on (top right).
3. Click **Load unpacked** and select the folder you just cloned into.
4. Pin the extension to your toolbar (click the puzzle-piece icon → pin).

### 3. Use it

1. Navigate to a Skool lesson (or any page with a video).
2. Click the **Zoom Skool Video** icon in the toolbar.
3. Click the icon again — or press **Esc** — to exit.

### Updating after pulling new changes

After `git pull`, go to `chrome://extensions/` and click the circular **reload** arrow on the extension card. Then hard-reload (`Cmd+Shift+R`) any Skool tab so any in-page state from the previous version is cleared.

## How it works (for the FE-curious)

The extension is two files:

- **`manifest.json`** — declares an MV3 extension with a toolbar `action` button. It uses `activeTab` (so the extension only runs on the tab where you click the icon — no broad host permissions needed) and `scripting` (so the background script can inject code into the active tab on demand).
- **`background.js`** — a service worker that listens for `chrome.action.onClicked` and calls `chrome.scripting.executeScript({ func: toggleVideoZoom })`. The function runs in the page's context, so it can read and modify the DOM directly.

A few design choices worth understanding:

- **State on `window`.** The injected function persists state at `window.__zoomSkoolVideoState__` across clicks. First click sees no state and activates; second click sees state and deactivates. No message passing or background-script state is needed.
- **Hide-everything-else via CSS, not z-index.** Layering a black backdrop over the page and trying to lift the iframe above it with `z-index` fails because Skool's wrappers create their own stacking contexts. Instead, the iframe and every ancestor up to `<html>` are tagged with `data-zsv-target` / `data-zsv-keep`, and a stylesheet sets `display: none !important` on every body descendant that isn't on that chain. Nothing else renders, so there's no z-index battle.
- **Strip ancestor properties that fight `position: fixed`.** The video iframe is positioned `fixed` so it can fill the viewport, but `position: fixed` is relative to the nearest ancestor with `transform`, `filter`, `perspective`, `clip-path`, or `contain` set. Skool uses some of these, so the keep-marked ancestors get those properties reset (along with `background`, so their default white panel doesn't leak through).
- **Vertical text via `writing-mode: vertical-rl`.** This gives each text label a real vertical box that participates in flex layout, rather than rotating with `transform` (which would leave a horizontal box behind). The left column adds `transform: rotate(180deg)` on top so it reads bottom-to-top, while the right column reads top-to-bottom by default.
- **Logo extracted as a URL, not cloned.** Skool's logo wrapper is an empty `<div>` with a CSS `background-image` set via class. The code reads the computed `background-image`, extracts the URL, and renders it into a fresh transparent element — that way we don't drag along the original element's white background or sizing. A CSS `filter: invert(1) hue-rotate(180deg)` inverts the image's baked-in white background to black while preserving the icon's color.

## Tweaking

The most useful constants live near the top of `toggleVideoZoom()` in `background.js`:

- `SIDEBAR_PX` — width of each side column (default `80`).
- The `.zsv-text` rule's `font-size` and `gap` control text size and spacing between breadcrumb items.
- The `[${TARGET_ATTR}]` rule sets the iframe's `width`, `height`, and aspect ratio. Currently `width: calc(100vw - 160px); height: calc((100vw - 160px) * 9 / 16)`.

## Caveats

- Selectors target Skool's styled-components class prefixes (`[class*="GroupLogoWrapper"]`, etc.). If Skool ships a redesign that renames the underlying components, the breadcrumb text will silently fall back to empty. The video zoom itself will still work.
- The MV3 `activeTab` permission means the extension only injects when you click the icon. If you'd prefer it to auto-run on Skool pages, switch to a content script with a `matches: ["https://www.skool.com/*"]` host pattern.
