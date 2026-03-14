# Electron Release Pipeline Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a GitHub Actions workflow that builds and publishes the Electron app for macOS and Windows whenever a `v*` tag is pushed.

**Architecture:** One workflow file with three jobs: `build-macos` and `build-windows` run in parallel on their respective runners using `electron-forge make --targets` to produce platform-specific binaries, upload them as artifacts, then `release` downloads all artifacts and creates a GitHub Release via `softprops/action-gh-release@v2`.

**Tech Stack:** GitHub Actions, Electron Forge 7, `actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-artifact@v4`, `actions/download-artifact@v4`, `softprops/action-gh-release@v2`

---

## Chunk 1: Create and validate the release workflow

### Task 1: Create `.github/workflows/release.yml`

**Files:**
- Create: `.github/workflows/release.yml`

**Background — critical footgun to avoid:**
`actions/upload-artifact` resolves paths relative to `GITHUB_WORKSPACE` (the repo root), **not** relative to `defaults.run.working-directory`. Since the Electron app lives at `electron-app/`, artifact upload paths must include the `electron-app/` prefix even though `run` steps use `working-directory: electron-app`. Missing this prefix causes a silent failure — the upload succeeds but attaches zero files.

- [ ] **Step 1: Create the workflow directory**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Create `.github/workflows/release.yml` with the following content**

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  build-macos:
    runs-on: macos-latest
    defaults:
      run:
        working-directory: electron-app
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      # --targets restricts to MakerZIP only. forge.config.ts has no platform
      # guards on other makers; --targets makes CI intent explicit.
      - run: npm run make -- --targets @electron-forge/maker-zip

      # Path is relative to GITHUB_WORKSPACE (repo root), NOT working-directory.
      # electron-app/ prefix is required — upload-artifact ignores defaults.run.working-directory.
      - uses: actions/upload-artifact@v4
        with:
          name: macos-artifacts
          path: electron-app/out/make/zip/darwin/**/*.zip

  build-windows:
    runs-on: windows-latest
    defaults:
      run:
        working-directory: electron-app
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      # --targets restricts to MakerSquirrel only (MakerDeb/MakerRpm would fail on Windows).
      - run: npm run make -- --targets @electron-forge/maker-squirrel

      # *Setup*.exe targets only the installer: Forge names it "{productName} Setup {version}.exe".
      # Excludes .nupkg, RELEASES, and stub executables that Squirrel places alongside.
      # Path is relative to GITHUB_WORKSPACE — electron-app/ prefix required.
      - uses: actions/upload-artifact@v4
        with:
          name: windows-artifacts
          path: electron-app/out/make/squirrel.windows/**/*Setup*.exe

  release:
    runs-on: ubuntu-latest
    needs: [build-macos, build-windows]
    steps:
      # download-artifact@v4 without a name downloads ALL artifacts.
      # path: artifacts/ places each artifact in a subdirectory named after
      # its artifact name (e.g. artifacts/macos-artifacts/, artifacts/windows-artifacts/).
      # The files: glob below traverses these subdirectories automatically.
      - uses: actions/download-artifact@v4
        with:
          path: artifacts

      - uses: softprops/action-gh-release@v2
        with:
          files: artifacts/**/*
```

- [ ] **Step 3: Validate YAML syntax**

```bash
# Install yamllint if not present: pip install yamllint
yamllint .github/workflows/release.yml
```

Expected: no errors. If `yamllint` isn't available, at minimum visually confirm indentation is consistent (GitHub Actions uses 2-space indentation; mixing tabs/spaces will cause parse errors).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add GitHub Actions release workflow for macOS and Windows"
```

---

### Task 2: End-to-end test — push a tag and verify the workflow runs

**Files:** none (verification only)

This step verifies the workflow actually runs. You need a pushed branch and a pushed tag. Do this against a non-main branch so you don't pollute the release history with a test tag.

- [ ] **Step 1: Push your current branch to GitHub**

```bash
git push -u origin HEAD
```

- [ ] **Step 2: Create and push a test tag**

```bash
git tag v0.0.1-test
git push origin v0.0.1-test
```

- [ ] **Step 3: Watch the workflow in GitHub Actions**

Open your repo on GitHub → Actions tab → "Release" workflow. You should see a new run triggered by the tag push.

Expected behavior:
- `build-macos` and `build-windows` start in parallel
- Both jobs run `npm ci` and `npm run make ...` — this will take a few minutes
- If both succeed, `release` starts and creates a GitHub Release named `v0.0.1-test` with two attached files: a `.zip` (macOS) and a `Setup.exe` (Windows)

- [ ] **Step 4: Verify the GitHub Release**

In your repo → Releases → `v0.0.1-test`. Confirm:
- A `.zip` file is attached (macOS artifact)
- A `*Setup.exe` file is attached (Windows artifact)
- No `.nupkg` or `RELEASES` files are attached

- [ ] **Step 5: Delete the test tag and test release (cleanup)**

On GitHub: go to Releases → delete `v0.0.1-test` release. Then delete the tag:

```bash
git tag -d v0.0.1-test
git push origin --delete v0.0.1-test
```

---

## How to use in practice

To publish a real release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The workflow fires automatically. The resulting GitHub Release is named `v1.0.0` and contains the macOS `.zip` and Windows `Setup.exe`.
