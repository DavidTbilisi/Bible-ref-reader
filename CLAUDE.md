# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page browser app that parses a Bible reference typed into a search box (e.g. `Gen 1:10-16` or `დაბ 1:10-16`) and fetches the matching verses from a remote API. Primary language is Georgian (`ka` / `geo`); the input accepts both Georgian book names and English-letter synonyms.

There is no package manager, no bundler, and no test suite. JS is loaded as native ES modules directly from `index.html`.

## Build pipeline

Build steps are defined in `.vscode/tasks.json` (run via VS Code's task runner). They depend on `pug` being on PATH.

- `build html` — renders `src/*.pug` to repo root with `pug -P -o ./ ./src/*.pug`
- `build js` — copies `src/javascript/*` to repo root with `cp`
- `build` — both of the above
- `clean` — `rm -rf *.html *.js` (destructive: wipes top-level HTML/JS)
- `rebuild` / `cleanRebuild` — clean then build (`cleanRebuild` is the default build task)

`style.css` is checked in next to `style.css.map`; the SCSS source is `src/style.scss` but no task compiles it — do it manually if you touch the SCSS.

Important: **the top-level `Bible.js`, `Parser.js`, `books.js`, `main.js`, and `index.html` are build outputs**. Edits made directly to them will be overwritten by `cleanRebuild`. Source-of-truth lives in `src/`. In practice the repo's git history shows direct edits to the top-level files happen anyway — check both locations when changing behavior, and be deliberate about which you treat as canonical for a given change.

## Architecture

Three modules, wired together in `main.js`:

- `Bible.js` — REST client for the multilingual API at `https://davidchincharashvii.pythonanywhere.com`. Three endpoints:
  - `parseReference(query, {lang, version})` → `/api/search/<lang>/<ver>/<query>` (server-side reference parser; handles `john 3:16-18, 20-22` and case-insensitive synonyms).
  - `textSearch(term, {lang, version})` → `/api/textsearch/<lang>/<ver>/<term>` (substring search across a whole translation).
  - `getVerses({bookId, chapter, verseStart, verseEnd})` → legacy direct-lookup; kept for back-compat but no longer used by the UI.
  Per-call `{lang, version}` overrides take precedence over instance state set via `setLanguage()` / `setVersion()`.
- `Parser.js` — owns the DOM. Binds `keyup` to the input and `change` to the translation controls; reads enabled `{lang, version}` pairs from `#translations`; dispatches one request per pair through `Bible.js`; renders each translation into its own `.translation-result` panel inside `#result`. A leading `/` in the query switches to text-search mode (e.g. `/light`). API errors (HTTP 404 with `{error}`) are rendered verbatim into the corresponding panel.
- `books.js` — orphan after the rewrite (no longer imported). Kept in the repo as data and to keep the `#books` datalist hint in sync; safe to delete if the autocomplete becomes lang-aware.

The reference parsing is now server-side — the API accepts both `Gen 1:10-16` and `დაბ 1:10-16` and resolves synonyms internally. There is no client-side regex.

### Translation controls

The `#translations` fieldset hardcodes the API's translation registry as `data-lang` rows: `ka` (`geo`, `orthodox`), `en` (`kjv`, `asv`, `nkjv`, `nasb`, `niv`), `ru` (`rusv`, `bti`). Each row has a checkbox + a version `<select>`. All three default to checked. Multiple languages may be enabled simultaneously — results render side-by-side via CSS grid (`grid-template-columns: repeat(auto-fit, minmax(340px, 1fr))`).

### Themes, presentation mode, and parallel scrolling

Two themes — `vellum` (warm cream paper) and `compline` (warm near-black with gilt accents) — selected by `data-theme` on `<html>`. Initial value follows `prefers-color-scheme` and persists to `localStorage` under `bible.theme`. Wired in `main.js`; toggle is `#theme-toggle`. Both themes are designed for sustained reading: serif body (EB Garamond), serif display (Cormorant Garamond), and the bundled `bgp_arial` constrained to `unicode-range: U+10A0-10FF` so Latin/Cyrillic glyphs don't fall through to it.

Presentation mode (`data-mode="presentation"` on `<html>`) hides chrome and bumps verse text to ~1.85rem with ~2.05 line-height. Toggle via `#presentation-toggle` or **Escape** (which only exits — it does not enter, by design).

Each translation panel scrolls independently (`max-height` + `overflow-y: auto`). `Parser.setupSyncScroll()` wires the panels for verse-aligned parallel scrolling: when the user scrolls panel A, `topMostVerse()` finds the topmost-visible verse's `data-v` and `scrollToVerse()` aligns the same-numbered verse in every other panel to the same offset. A `_syncing` flag (released via `requestAnimationFrame`) prevents handler feedback loops. Verses missing in another panel (e.g., different versification or an error panel) are silently skipped.

Each `.verse` carries `data-v="<verse-number>"`. The number is extracted from object keys (when verses come back as a `{N: "..."}` map), from a leading `"N."` regex when the API returns an array of strings with embedded numbers, or falls back to array index + 1 when verses are unnumbered. The number is then rendered as a small superscript `.v-num` in the rubric color (manuscript red in vellum, gilt amber in compline).

## Helper script

`src/options.py` is a one-off generator that reads `../books.js` and prints Pug `option(value="…")` lines for the datalist in `src/index.pug`. Re-run it after adding books to keep the autocomplete list in sync.

## Tests

use tests as a contract for expected behavior and a safety net against regressions. red-green-refactor cycles are encouraged, but make sure to run the full suite against the live API before merging, since the mocked tests don't guarantee the mock matches reality.

Playwright e2e suite under `tests/e2e/`. First-time setup: `npm install && npx playwright install chromium`.

- `npm test` — full suite (mocked + live smoke).
- `npm run test:mocked` — hermetic; intercepts fetches to the pythonanywhere API. This is what to run during development.
- `npm run test:smoke` — hits the real backend. Slow and externally dependent; tagged `@smoke`.

Playwright's `webServer` config spawns `http-server` on port 4173 automatically — no need to start anything manually. The mocked suite uses `page.route()` to intercept `https://davidchincharashvii.pythonanywhere.com/**`; unrecognized paths return 404 so the `No Results` UI path stays testable.

V8 JS coverage is collected via `monocart-reporter` (see `tests/e2e/fixtures/coverage.js`). The mocked suite currently hits **100% line/branch/function coverage** across `Bible.js`, `Parser.js`, `main.js`, and `books.js`. Reports land in `coverage/`; the HTML SPA is `coverage/index.html`, and a JSON summary is `coverage/coverage-summary.json`. Two things to watch when extending tests:

- `fill()` does not dispatch `keyup`. Use the `search()` helper in `parser.spec.js` (fills then dispatches keyup), or call `dispatchEvent('keyup')` manually. Otherwise the Parser handler never runs and tests look like the page is broken.
- Branches that aren't reachable from the input box (custom language/version on `Bible.js`, bare-bookId switch default) are covered by `bible.spec.js`, which dynamically imports `Bible.js` inside `page.evaluate`.
- The mock interceptor (`mockApi` in `parser.spec.js`) matches by exact pathname; unmatched paths return HTTP 404 with `{error: "Chapter 99 does not exist in the Bible"}` so the API-error rendering path is exercised. To assert "X was requested," check the captured pathname array rather than asserting on response content.
- Tests use the `selectLanguages(page, ['ka', 'en'])` helper to flip the translation checkboxes programmatically before triggering a search. The default state has only `ka` enabled.
