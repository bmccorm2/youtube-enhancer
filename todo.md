# YouTube Enhancer (speed only), Chrome + Firefox

## Goal
A personal browser extension that starts every YouTube watch-page video at a default speed (2x), and adds `−` / `+` buttons with a live speed readout to the player's control bar. It replaces "Enhancer for YouTube", which is used only for speed.

## Context
- Project dir: `/Users/bryan/src/youtube-enhancer` (currently empty, not a git repo).
- Plain JavaScript, Manifest V3, **no build step, no framework, no npm dependencies**. One codebase loads unchanged in Chrome and Firefox.
- Tooling (run ad hoc, not added as deps): `bunx web-ext lint`, `bunx web-ext run` (Firefox), `bunx web-ext sign`. User shell is fish.
- Browser API: use `const api = globalThis.browser ?? globalThis.chrome;` and the promise-based `api.storage.sync` in both browsers.
- Target file layout:
  ```
  manifest.json
  src/content.js      # speed logic + control injection
  src/content.css     # control styling
  popup/popup.html    # settings popup
  popup/popup.js
  popup/popup.css
  README.md           # install/sign instructions
  .gitignore          # web-ext-artifacts/, .env, .DS_Store
  ```

## Decisions
- Plain JS, MV3, no build step, shared codebase. Svelte etc. was considered and rejected.
- Runs only on `https://www.youtube.com/*`, and acts only on `/watch` pages, on the main player video (`#movie_player video.html5-main-video`).
- **Shorts (`/shorts/...`) are completely untouched**: no speed change, no controls. Hover previews on the home feed, music.youtube.com and embedded players on other sites are untouched too.
- Ads are not handled (the user has Premium).
- Default speed is **2x**. Step is **0.25x**. Range is **min 0.5x, max 3.0x**.
- Every new video (new `v=` id, including autoplay-next and playlist advance) resets to the default speed. Speed changes are not remembered between videos.
- Controls sit in YouTube's player control bar (`.ytp-right-controls`), inserted as its first child (left of the settings gear), laid out as `−  2x  +`.
- Speed label format: up to 2 decimals with trailing zeros trimmed, plus `x` (`2x`, `2.25x`, `1.5x`, `0.75x`).
- Clicking `−`/`+` changes speed by one step, clamped to [0.5, 3.0], rounded to 2 decimals (avoids float drift). The button at a limit is disabled.
- If the speed changes some other way (YouTube's own menu or Shift+< / Shift+>), the label updates to match through `ratechange`. That speed is not clamped.
- Popup settings, saved to `storage.sync` on change:
  - `defaultSpeed`: number input, min 0.5, max 3, step 0.05, default 2.
  - `step`: number input, min 0.05, max 1, step 0.05, default 0.25.
  - Invalid or out-of-range input is clamped on save, and the input shows the clamped value.
  - Changes apply to open tabs through `storage.onChanged`: `step` takes effect immediately, and `defaultSpeed` from the next video on.
- No keyboard shortcuts, no icons (browser default icon is fine), no other features.
- Distribution: personal use only. Chrome loads it unpacked. Firefox uses an unlisted, self-signed `.xpi` made with `web-ext sign --channel=unlisted`. Nothing is published to the stores.
- Firefox needs `browser_specific_settings.gecko.id = "youtube-enhancer@bryan.local"` and `strict_min_version: "115.0"`. Chrome's "unrecognized key" warning for this is acceptable.
- Permissions: `"storage"` only. The content script matches `https://www.youtube.com/*`.

## Tasks
Mark each task `- [x]` here as soon as it is done.

- [x] 1. `git init`; add `.gitignore` (`web-ext-artifacts/`, `.env`, `.DS_Store`). Do **not** commit without user approval.
- [x] 2. `manifest.json`: `manifest_version: 3`, name "YouTube Enhancer", version `0.1.0`, `permissions: ["storage"]`, `action.default_popup: "popup/popup.html"`, `content_scripts: [{ matches: ["https://www.youtube.com/*"], js: ["src/content.js"], css: ["src/content.css"], run_at: "document_idle" }]`, `browser_specific_settings` as in Decisions.
- [x] 3. `src/content.js`, settings and helpers:
  - Constants `MIN = 0.5`, `MAX = 3`, `DEFAULTS = { defaultSpeed: 2, step: 0.25 }`.
  - Load settings from `api.storage.sync.get(DEFAULTS)` at startup, and keep them current with `api.storage.onChanged`.
  - `clamp(rate)`, `round2(rate)`, `formatRate(rate)` (e.g. `2.25 → "2.25x"`, `2 → "2x"`).
  - `isWatchPage()` → `location.pathname === "/watch"`. `currentVideoId()` → `new URLSearchParams(location.search).get("v")`.
  - `getVideo()` → `document.querySelector("#movie_player video.html5-main-video")`.
- [x] 4. `src/content.js`, default speed per video:
  - Keep `lastVideoId` and a `pendingDefault` flag.
  - On startup and on `document` event `yt-navigate-finish`: if `isWatchPage()` and `currentVideoId() !== lastVideoId`, set `lastVideoId`, set `pendingDefault = true`, and apply the default now if the video exists.
  - Add **capture-phase** listeners on `document` for `loadedmetadata` and `playing` (media events don't bubble). Ignore targets that are not `getVideo()`, and ignore everything when not on a watch page. While `pendingDefault` is true, set `video.playbackRate = settings.defaultSpeed`. On the first `playing` that has the default speed in effect, set `pendingDefault = false`. This stops YouTube from overriding the default at load time, while letting the user's later changes stick.
  - Never act on `/shorts/` or any other non-watch path.
- [x] 5. `src/content.js`, controls:
  - `ensureControls()`: on a watch page, find `#movie_player .ytp-right-controls`. If `#yte-speed` doesn't exist, insert a container `<div id="yte-speed">` holding `<button class="ytp-button yte-dec">−</button><span class="yte-label">…</span><button class="ytp-button yte-inc">+</button>` as its first child. Give the buttons `title`/`aria-label` values "Slower" and "Faster".
  - Call it on startup and on `yt-navigate-finish`. If the control bar isn't there yet, retry every 250 ms for up to 10 s.
  - Button click: `video.playbackRate = clamp(round2(video.playbackRate ± settings.step))`. Call `stopPropagation()` so the player doesn't react.
  - Capture-phase `ratechange` listener (main video only): update the label, and disable `−` at ≤ MIN and `+` at ≥ MAX.
  - Don't insert duplicate controls across SPA navigations (the player element is reused).
- [x] 6. `src/content.css`: `#yte-speed` is an inline-flex row, vertically centered, the same height as the other `.ytp-button`s. The label is white, about 13px, `min-width` wide enough for "2.25x" so it doesn't jitter, and centered. The buttons are narrow (about 28px), with a large bold glyph. Disabled buttons have `opacity: .4`. It must look right in normal, theater and fullscreen modes.
- [x] 7. `popup/popup.html|js|css`: two labeled number inputs ("Default speed", "Step"), using the attributes from Decisions. Load them from `storage.sync.get(DEFAULTS)`. On `change`, clamp and save. Show a brief "Saved" text. Use small dark styling and no external assets.
- [x] 8. `README.md`: short sections in fish-compatible commands for:
  - Chrome: `chrome://extensions`, Developer mode, then "Load unpacked" → the project dir.
  - Firefox dev: `bunx web-ext run`.
  - Firefox permanent: create AMO API keys at addons.mozilla.org/developers/addon/api/key/, then run `bunx web-ext sign --channel=unlisted --api-key=$AMO_JWT_ISSUER --api-secret=$AMO_JWT_SECRET`, then install the `.xpi` from `web-ext-artifacts/`. Bump `version` in `manifest.json` before every re-sign.
  - Firefox: check that the add-on has the youtube.com site permission in `about:addons` → YouTube Enhancer → Permissions.
- [x] 9. Run `bunx web-ext lint` and fix any errors (warnings about `browser_specific_settings` in Chrome are fine).
- [ ] 10. Do the manual acceptance checks below in **both** Chrome and Firefox, and report the results.

## Acceptance criteria
- `bunx web-ext lint` reports 0 errors.
- The extension loads without errors in Chrome (unpacked) and Firefox (`web-ext run`), and the console shows no errors from the content script.
- Opening `youtube.com/watch?v=…` directly starts playback at 2x, and the control shows `2x`.
- Navigating within YouTube to another video (click, autoplay-next, playlist next) resets it to 2x.
- `+` from 2x shows 2.25x, 2.5x, 2.75x, 3x, and then `+` is disabled. `−` goes down to 0.5x and is then disabled. The actual playback speed matches the label.
- Changing speed through YouTube's settings menu or Shift+< / Shift+> updates the label.
- After several SPA navigations there is still exactly one `#yte-speed` in the DOM.
- On `/shorts/…`: there are no controls and the speed is unchanged (1x).
- Feed hover previews are unaffected.
- Popup: setting default 1.5 and step 0.5 makes the next video start at 1.5x and step by 0.5 immediately. Entering 10 as the default saves and shows 3.
- Settings survive a browser restart.
- Controls display correctly in theater mode and fullscreen.

## Out of scope
- Keyboard shortcuts, per-channel or per-video memory, ad handling, Shorts, music.youtube.com, embeds, icons, store listings, any other Enhancer-for-YouTube features.
- Build tools, frameworks, TypeScript, npm dependencies, automated tests.

## Notes / risks
- YouTube is a SPA. The page doesn't reload between videos, so rely on `yt-navigate-finish` plus media events, not page load.
- YouTube may reset `playbackRate` while a video loads. That is why the default is enforced until the first `playing`. If 2x still doesn't stick in testing, also re-apply on `canplay` while `pendingDefault` is true. Do not add a permanent interval that fights the user.
- Content scripts run in an isolated world and can't call `movie_player.setPlaybackRate`. Set `video.playbackRate` directly. YouTube's own speed menu may show a stale value, which is acceptable.
- Live streams at the live edge may ignore speeds above 1x. This is acceptable and needs no special handling.
- YouTube class names (`.ytp-right-controls`, `.html5-main-video`, `#movie_player`) may change over time. Keep selectors in constants at the top of `content.js`.
- Firefox unlisted signing needs a (free) AMO account. Each re-sign needs a higher `version`.
