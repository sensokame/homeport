## homeport v1.0.0

The first stable release. Dashboard management, module federation, focus mode, and the panel UX are all complete.

---

### What's new

**PWA support**

- `manifest.webmanifest` with standalone display mode and homeport icon
- Full-screen installation via "Add to Home Screen" on Android and iOS
- `theme-color` meta tag for immersive status bar styling

**Swipe tab switching**

- Swipe left/right anywhere on the widget grid to switch between tabs
- Touch-first UX for wall-mounted panel use (e.g. Lenovo P12)
- No conflict with focus mode or per-widget swipe cards — gesture is only active in the normal grid view

**Legacy widget removal**

- `legacy.widget` removed from the registry — all satellites now ship federated React components
- `WidgetCard` and `WidgetData` removed from `@homeport/ui` — no longer needed

**Documentation**

- [Getting Started](https://sensokame.github.io/homeport/getting-started/) — corrected widget IDs for all satellites
- [Widget System](https://sensokame.github.io/homeport/widgets/) — complete `WidgetProps` reference, federation pattern, focus mode
- [Building a Satellite](https://sensokame.github.io/homeport/satellites/building-a-satellite/) — end-to-end guide for creating and registering a satellite
- [Architecture](https://sensokame.github.io/homeport/architecture/) — panel concept, hub + satellite model, monorepo structure
- [Calendar satellite](https://sensokame.github.io/homeport/satellites/gcal/) — new satellite doc

---

### Docker images

```
ghcr.io/sensokame/homeport-hub:1.0.0
ghcr.io/sensokame/homeport-infra:1.0.0
ghcr.io/sensokame/homeport-inventory:1.0.0
ghcr.io/sensokame/homeport-obsidian:1.0.0
ghcr.io/sensokame/homeport-vikunja:1.0.0
ghcr.io/sensokame/homeport-wger:1.0.0
ghcr.io/sensokame/homeport-actual:1.0.0
ghcr.io/sensokame/homeport-gcal:1.0.0
```

All satellite images are unchanged from v0.9.0 except hub.
