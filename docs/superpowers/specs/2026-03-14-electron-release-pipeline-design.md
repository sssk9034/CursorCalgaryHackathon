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

- Runner: `macos-latest` (resolves to `macos-15`, which is ARM64)
- Working directory for all npm steps: `electron-app/` (use `defaults.run.working-directory` at the job level)
- Steps:
  1. Checkout repo
  2. Set up Node.js 20
  3. `npm ci`
  4. `npm run make -- --targets @electron-forge/maker-zip`
     - Pass `--targets` to be explicit about intent and avoid platform-detection edge cases. `forge.config.ts` currently has no platform guards on MakerSquirrel, MakerDeb, or MakerRpm — Forge will skip unsupported makers via `isSupportedOnCurrentPlatform()` checks, but using `--targets` makes the CI intent unambiguous.
  5. Upload artifacts matching `electron-app/out/make/zip/darwin/**/*.zip` using `actions/upload-artifact@v4`
     - Path must be relative to `GITHUB_WORKSPACE` (repo root), NOT to `defaults.run.working-directory`. `upload-artifact` ignores `defaults.run.working-directory`, so the `electron-app/` prefix is required here.
     - Arch-agnostic glob — works for both `x64` and `arm64` output.

### `build-windows`

- Runner: `windows-latest`
- Working directory for all npm steps: `electron-app/` (use `defaults.run.working-directory` at the job level)
- Steps:
  1. Checkout repo
  2. Set up Node.js 20
  3. `npm ci`
  4. `npm run make -- --targets @electron-forge/maker-squirrel`
     - Must pass `--targets` to restrict to MakerSquirrel only, avoiding MakerDeb and MakerRpm which would fail on Windows.
  5. Upload `electron-app/out/make/squirrel.windows/**/*Setup*.exe` using `actions/upload-artifact@v4`
     - Path must be relative to `GITHUB_WORKSPACE` (repo root), NOT to `defaults.run.working-directory`. `upload-artifact` ignores `defaults.run.working-directory`, so the `electron-app/` prefix is required here.
     - Use `*Setup*.exe` to target only the installer (Forge names it `{productName} Setup {version}.exe`) and exclude any stub executables Squirrel may produce alongside it. `.nupkg` and `RELEASES` files have different extensions and will not match.

### `release`

- Runner: `ubuntu-latest`
- Depends on: `build-macos`, `build-windows`
- Steps:
  1. Download all artifacts into a common directory (e.g., `path: artifacts/`) using `actions/download-artifact@v4`
     - Without a `path`, v4 places each artifact in a subdirectory named after the artifact. Using `path: artifacts/` keeps them all under one root, so the release step can glob `artifacts/**/*` to find all files regardless of artifact names.
  2. Create GitHub Release using `softprops/action-gh-release@v2`, with `files: artifacts/**/*` to attach all downloaded binaries
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
| macOS    | MakerZIP      | `electron-app/out/make/zip/darwin/**/*.zip`            | Extract and run `.app` |
| Windows  | MakerSquirrel | `electron-app/out/make/squirrel.windows/**/*Setup*.exe` | Run the installer  |

---

## Out of Scope

- Code signing / notarization (deferred — demo only)
- Linux builds (deferred)
- Auto-bumping `package.json` version from the tag
- Draft releases or release notes automation
- Browser extension bundling (separate project, separate concern)
