# Electron Release Pipeline — Design Spec

**Date:** 2026-03-14
**Status:** Approved

---

## Goal

Automatically bundle and publish the Electron desktop app as a GitHub Release whenever a `v*` tag is pushed (e.g., `v1.0.0`). Produces binaries for macOS (`.zip`) and Windows (Squirrel `.exe` installer). No code signing — demo/hackathon use only.

---

## Trigger

```yaml
on:
  push:
    tags:
      - 'v*'
```

Only fires on semver-style tags pushed manually. Normal branch commits are unaffected.

---

## Job Structure

Three jobs run in sequence:

```
build-macos  ──┐
               ├──► release
build-windows ─┘
```

### `build-macos`

- Runner: `macos-latest`
- Steps:
  1. Checkout repo
  2. Set up Node.js 20
  3. `npm ci` inside `electron-app/`
  4. `npm run make` inside `electron-app/`
  5. Upload artifacts from `electron-app/out/make/zip/darwin/**/*.zip` using `actions/upload-artifact@v4`

### `build-windows`

- Runner: `windows-latest`
- Steps:
  1. Checkout repo
  2. Set up Node.js 20
  3. `npm ci` inside `electron-app/`
  4. `npm run make` inside `electron-app/`
  5. Upload artifacts from `electron-app/out/make/squirrel.windows/**/*Setup.exe` using `actions/upload-artifact@v4`

### `release`

- Runner: `ubuntu-latest`
- Depends on: `build-macos`, `build-windows`
- Steps:
  1. Download all artifacts uploaded by the build jobs (`actions/download-artifact@v4`)
  2. Create GitHub Release using `softprops/action-gh-release@v2`, attaching all downloaded files
- Permissions needed: `contents: write`

---

## File Location

Single workflow file at repo root:

```
.github/workflows/release.yml
```

---

## Permissions

The workflow uses the built-in `GITHUB_TOKEN` (no personal access token needed). The job requires:

```yaml
permissions:
  contents: write
```

This allows creating releases and uploading assets.

---

## Artifacts Produced

| Platform | Maker         | Output path pattern                                    | What users run     |
|----------|---------------|--------------------------------------------------------|--------------------|
| macOS    | MakerZIP      | `out/make/zip/darwin/x64/*.zip`                        | Extract and run `.app` |
| Windows  | MakerSquirrel | `out/make/squirrel.windows/x64/*Setup.exe`             | Run the installer  |

---

## Out of Scope

- Code signing / notarization (deferred — demo only)
- Linux builds (deferred)
- Auto-bumping `package.json` version from the tag
- Draft releases or release notes automation
- Browser extension bundling (separate project, separate concern)
