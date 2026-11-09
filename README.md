# YouTube Enhancer

Starts every YouTube video at a default speed (2x) and adds `−` / `+` speed buttons to the player. Settings are in the toolbar popup.

## Chrome

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this project directory.

## Firefox (dev)

```fish
bunx web-ext run
```

## Firefox (permanent, self-signed)

1. Create AMO API keys at https://addons.mozilla.org/developers/addon/api/key/
2. Bump `version` in `manifest.json` (needed before every re-sign).
3. Sign:

   ```fish
   set -x AMO_JWT_ISSUER user:xxxx
   set -x AMO_JWT_SECRET xxxx
   bunx web-ext sign --channel=unlisted --api-key=$AMO_JWT_ISSUER --api-secret=$AMO_JWT_SECRET
   ```

4. Install the `.xpi` from `web-ext-artifacts/` (drag it into Firefox, or `about:addons` → gear → Install Add-on From File).
5. In `about:addons` → YouTube Enhancer → **Permissions**, make sure the youtube.com site permission is on.
