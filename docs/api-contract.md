# Bible API contract

Upstream: `https://davidchincharashvii.pythonanywhere.com` — source at
[github.com/DavidTbilisi/Georgian_bible_api](https://github.com/DavidTbilisi/Georgian_bible_api).

This documents the **subset of the API this app depends on**, not the full
upstream surface. Update this file whenever `Bible.js` changes how it talks
to the server, or whenever an upstream change breaks a test.

## Endpoints

### 1. Direct lookup — *primary path*

```
GET /api/<lang>/<version>/<bookId>[/<chapter>[/<verseStart>[/<verseEnd>]]]
```

- Bypasses the per-language synonym parser entirely.
- `bookId` is `1..66`. The Western canon (en, ru) and Georgian Orthodox canon (ka) **diverge in the NT** — Romans is `id=45` in en/ru but `kaId=52` in ka. The mapping lives in `book-registry.js`.
- Trailing parts are optional. Each level narrows the result:
  - `/12` — whole book
  - `/12/3` — whole chapter
  - `/12/3/10` — single verse
  - `/12/3/10/16` — verse range

### 2. Reference parser — *fallback only*

```
GET /api/search/<lang>/<version>/<URL-encoded query>
```

- Used by `Parser.referenceLookup` **only when client-side parsing fails** (unknown book token, comma-separated multi-range, etc.).
- Per-language synonym tables are sparse and inconsistent: KJV accepts "Gen" but rejects "Genesis"; Russian rejects most variants. **Direct lookup is preferred** for this reason.

### 3. Full-text search

```
GET /api/textsearch/<lang>/<version>/<URL-encoded term>
```

- Substring search over a single translation. Triggered by a leading `/` in the input.

## Languages × versions

Hardcoded in `index.html` (`#translations` fieldset). Source of truth — no auto-discovery.

| `lang` | versions |
| --- | --- |
| `ka` | `geo` (sbs), `orthodox` |
| `en` | `kjv`, `asv`, `nkjv`, `nasb`, `niv` |
| `ru` | `rusv` (Синод.), `bti` |

Adding a translation = update `index.html`, `book-registry.js` (book names/synonyms), and any tests that mock by language.

## Response shapes

### Reference / direct lookup (success)

```json
{
  "book": "Genesis",
  "chapter": 1,
  "verses": { "10": "10. And God called the dry land Earth..." }
}
```

`verses` is one of three shapes — `Parser.parseVerses` normalizes all three:

- **Object**: keys are stringified verse numbers; values may include a leading `"N."` or `<sup class="versenum">N </sup>` (KJV).
- **Array**: items may include a leading `"N. "` prefix or none at all. Falls back to array index + 1.
- **String**: single-verse response, no number.

### Text search (success)

```json
{
  "matches": [
    {
      "book": "Genesis",
      "chapter": 1,
      "verse": 1,
      "text": "In the beginning God created the heaven and the earth.",
      "link": "https://davidchincharashvii.pythonanywhere.com/api/en/kjv/1/1/1"
    }
  ]
}
```

### Error (any endpoint)

```json
{ "error": "Chapter 99 does not exist in the Bible" }
```

HTTP **404**. Callers check `data.error` truthiness rather than `response.ok` — the error body still parses as JSON.

## Known quirks

- **KJV embeds HTML in verse bodies** — `<sup class="versenum">N </sup>`, occasional `<i>...</i>`. `peelVerse()` extracts the verse number from the `<sup>`; `stripHtml()` removes the rest.
- **Russian server-side parser rejects most book-name variants.** Always reach Russian via direct lookup; the `/api/search/` fallback returns `Book 'None' not found` for nearly anything.
- **Verse counts vary across translations** (Psalm versification, deuterocanonicals). Chapter counts hardcoded in `keynav.js` are Western-canon — Orthodox `ka/*` may differ for a handful of books.
- **Orthodox NT order**: `ka/*` places the Catholic Epistles (James, Peter, John, Jude) **before** the Pauline letters. `book-registry.js` carries the dual ordering as `id` (Western) and `kaId` (Georgian Orthodox).

## How drift is caught

- **Mocked suite** (`npm run test:mocked`) — runs on every push/PR via `.github/workflows/tests.yml`. Verifies UI behavior against hand-written fixtures. Does **not** catch upstream contract changes.
- **Live smoke** (`npm run test:smoke`, files tagged `@smoke`) — runs daily at 06:00 UTC and on manual dispatch. Hits the real backend. **This is the contract canary.** A red smoke run = the API changed under us.

When the smoke job fails, the workflow uploads `test-results/` and `playwright-report/` as artifacts (14-day retention). Start there.

## When you change `Bible.js`

1. Update this file in the same PR.
2. Update the mocked-test fixtures (`tests/e2e/fixtures/verses.js`) and mock paths in `tests/e2e/*.spec.js`. Test mocks are coupled to URL shape — a parser refactor without updating them is the canonical way these tests rot.
3. Run `npm run test:smoke` locally before merging if the change touches URL shape or response parsing.
