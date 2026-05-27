# Writing Documentation

## Building Locally

Install Zensical:

```bash
pip install zensical
```

Run the dev server from the `docs/` directory:

```bash
cd docs
zensical serve --port 8001
```

Open http://localhost:8001. Pages reload automatically as you edit.

Build the static site:

```bash
cd docs
zensical build
```

Output goes to `docs/site/`.

## Documentation Structure

```
docs/
  zensical.toml             config and nav
  index.md                  overview page
  getting-started/
    index.md                deploy guide
  architecture/
    index.md                hub + satellite model, widget protocol
  satellites/
    index.md                section index
    hub.md                  hub reference
    infra.md                infrastructure satellite reference
    inventory.md            inventory satellite reference
  ui/
    index.md                component library reference
  contributing/
    index.md                development setup, adding satellites
  writing-docs/
    index.md                this page
  stylesheets/
    theme-toggle.css        light/dark theme styles
  javascripts/
    theme-toggle.js         theme toggle logic
```

## Adding a Page

### New section

1. Create a folder: `docs/<section>/`
2. Add `docs/<section>/index.md`
3. Add the section to the nav in `zensical.toml`:
   ```toml
   {"My Section" = "<section>/index.md"}
   ```

### Sub-page within a section

1. Create `docs/<section>/my-page.md`
2. Link to it from the section's `index.md` — sub-pages don't need nav entries, just inline links

## Writing Style

- `#` for the page title, `##` for major sections, `###` for subsections — don't skip levels
- Code blocks with language tags: ` ```bash `, ` ```json `, ` ```tsx `
- Tables for reference data (env vars, props, API endpoints)
- Internal links use relative paths: `[Architecture](../architecture/index.md)`
- Keep content accurate to the actual code — if something changes, update the docs

## CI/CD

Documentation is built and deployed to GitHub Pages automatically on every push to `main`.

The workflow (`.github/workflows/docs.yml`):
1. Installs Zensical
2. Builds the site from `docs/`
3. Deploys to GitHub Pages at `sensokame.github.io/homeport`

No manual steps needed.

## Troubleshooting

**Port already in use:**
```bash
zensical serve --port 8002
```

**Navigation not updating after editing `zensical.toml`:**
Restart `zensical serve` and hard-refresh the browser.

**Changes not showing:**
Make sure you saved the file. Check the browser console for errors.
