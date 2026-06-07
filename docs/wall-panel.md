# Wall Panel Setup

homeport is designed to run on a wall-mounted tablet in always-on display mode — a Lenovo P12, a spare phone, or anything running Chrome on Android. This page covers deploying the hub and installing it as a PWA.

---

## 1. Deploy and verify the hub

Before installing, confirm the hub is running the v1.0.0 image (earlier versions have no PWA manifest):

```bash
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" | grep hub
```

If the image is out of date, rebuild and recreate:

```bash
cd /home/sensokame/workspace/homeport
docker build -f apps/hub/Dockerfile -t ghcr.io/sensokame/homeport-hub:latest .
docker compose -f /opt/station/internal.yml up -d --no-deps --force-recreate hub
```

Open `http://panel.station` in a desktop browser. The page should load. To confirm the manifest is present, open **DevTools → Application → Manifest** — you should see name "homeport", `display: standalone`, and the SVG icon.

---

## 2. Install as a PWA on Android (Lenovo P12)

1. Open **Chrome** on the tablet
2. Navigate to `http://panel.station`
3. Tap the three-dot menu (⋮) → **"Add to Home Screen"**
4. Keep the name "homeport" → tap **Add**
5. The app appears on the launcher — open it from there

> Chrome's automatic install banner requires HTTPS. `panel.station` is HTTP, so the banner won't appear — but manual "Add to Home Screen" works fine over HTTP and fully respects the manifest (standalone mode, correct icon, no URL bar).

---

## 3. What the PWA gives you

- **No browser chrome** — no URL bar, no navigation buttons, full screen
- **Home screen icon** — the homeport house icon
- **Swipe tab switching** — swipe left/right anywhere on the widget grid to move between tabs
- **Focus mode** — tap "focus →" on a widget to expand it full screen

---

## 4. Verifying after install

Open the app from the home screen. It should launch full screen with no browser UI. If the URL bar is still visible, the manifest wasn't loaded — check:

- Hub is running v1.0.0 (step 1 above)
- You opened from the home screen icon, not from Chrome directly
- The manifest link is present: view source at `panel.station` and confirm `<link rel="manifest" href="/manifest.webmanifest" />`

---

## 5. Always-on display

To keep the tablet always on and showing the panel:

- **Display timeout**: Settings → Display → Screen timeout → set to "Never" or the maximum
- **Daydream / screensaver**: disable, or set to "none"
- **Brightness**: lower it for night use; consider a browser extension or app for scheduled dimming
- **Auto-rotate**: lock to landscape

---

## 6. Updating the hub

After a hub update, refresh the PWA:

1. Open the installed app
2. The hub serves updated assets automatically — a hard refresh (`Ctrl+Shift+R` on a connected keyboard, or clear site data in Chrome settings) forces a clean reload if the old version is cached
