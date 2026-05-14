/*
DOM controller. Reads the search input + enabled translations and dispatches
one request per (lang, version) pair through Bible.js.

Modes:
  - reference (default)  — query goes to /api/search/<lang>/<ver>/<query>
  - text search          — query starts with "/"; the rest goes to
                           /api/textsearch/<lang>/<ver>/<term>

Each translation renders into a `.translation-result` panel. Verses are
tagged with `data-v="<verse-number>"` so panels can be scroll-synced by
verse rather than by pixel offset.
*/

import { parseQuery, bookIdFor } from "./book-registry.js";

const TEXT_SEARCH_PREFIX = "/";
const MAX_TEXT_MATCHES = 50;
const DEBOUNCE_MS = 180;

class Parser {
    constructor({ inputSelector, outputSelector, controlsSelector, bible }) {
        this.input = document.querySelector(inputSelector);
        this.output = document.querySelector(outputSelector);
        this.controls = document.querySelector(controlsSelector);
        this.bible = bible;
        this._syncing = false;
        this._showToken = 0;
        this._debounceTimer = null;
        const trigger = this.scheduleShow.bind(this);
        this.input.addEventListener("keyup", trigger);
        this.controls.addEventListener("change", trigger);
    }

    scheduleShow() {
        clearTimeout(this._debounceTimer);
        this._debounceTimer = setTimeout(() => this.show(), DEBOUNCE_MS);
    }

    getSelections() {
        const rows = this.controls.querySelectorAll(".translation");
        const out = [];
        rows.forEach((row) => {
            const checkbox = row.querySelector('input[type="checkbox"]');
            if (!checkbox.checked) return;
            const select = row.querySelector("select");
            const label = row.querySelector("label").textContent.trim();
            out.push({ lang: row.dataset.lang, version: select.value, label });
        });
        return out;
    }

    isTextSearch(query) {
        return query.startsWith(TEXT_SEARCH_PREFIX);
    }

    async show() {
        // Each show() acquires a monotonically increasing token; only the
        // most recent in-flight call is allowed to write to the DOM. Older
        // calls (e.g. partial "John" while the user kept typing) are
        // discarded even if their network response arrives last.
        const token = ++this._showToken;

        const raw = this.input.value;
        if (!raw) {
            this.output.innerHTML = "";
            return;
        }

        const selections = this.getSelections();
        if (selections.length === 0) {
            this.output.innerHTML = `<div class="error">Select at least one translation.</div>`;
            return;
        }

        const textMode = this.isTextSearch(raw);
        const query = textMode ? raw.slice(TEXT_SEARCH_PREFIX.length).trim() : raw.trim();
        if (!query) {
            this.output.innerHTML = "";
            return;
        }

        this.showLoading(selections);

        const results = await Promise.all(
            selections.map((sel) => this.fetchOne(sel, query, textMode)),
        );
        if (token !== this._showToken) return;
        this.render(results, textMode, query);
    }

    async fetchOne(sel, query, textMode) {
        const opts = { lang: sel.lang, version: sel.version };
        try {
            const data = textMode
                ? await this.bible.textSearch(query, opts)
                : await this.referenceLookup(sel, query, opts);
            return { sel, data };
        } catch (err) {
            return { sel, data: null, networkError: err };
        }
    }

    /**
     * Resolve a reference for a single translation:
     *   1. Parse client-side to a numeric book ID for this language's canon.
     *      Use direct lookup — this bypasses the server's synonym table
     *      entirely and works the same for every language and version.
     *   2. If we can't parse it (unknown book, comma-separated multi-range,
     *      etc.), fall back to /api/search/ with the original query —
     *      best-effort against whatever synonyms the server happens to know.
     */
    async referenceLookup(sel, query, opts) {
        const parsed = parseQuery(query);
        if (parsed) {
            return this.bible.directLookup({
                lang: sel.lang,
                version: sel.version,
                bookId: bookIdFor(parsed.book, sel.lang),
                chapter: parsed.chapter,
                verseStart: parsed.verseStart,
                verseEnd: parsed.verseEnd,
            });
        }
        return this.bible.parseReference(query, opts);
    }

    showLoading(selections) {
        const panels = selections
            .map(
                (s) => `<section class="translation-result" data-lang="${s.lang}">` +
                    `<header>${this.escape(s.label)}</header>` +
                    `<div class="panel-body"><div class="title">Loading…</div></div></section>`,
            )
            .join("");
        this.output.innerHTML = panels;
    }

    render(results, textMode, query) {
        this._panelMeta = results.map((r) => ({
            lang: r.sel.lang,
            book: r.data && !r.data.error ? r.data.book : null,
            chapter: r.data && !r.data.error ? r.data.chapter : null,
        }));
        this._textMode = textMode;
        this.output.innerHTML = results.map((r) => this.renderPanel(r, textMode)).join("");
        this.updateTitle(results, textMode, query);
        this.setupSyncScroll();
        this.updateLocator();
    }

    /**
     * Update the sticky presentation-mode locator (book chapter:verse) based
     * on the topmost visible verse in the first translation panel. Called on
     * every render and on every scroll. No-op when the locator element is
     * absent or when the panel has no resolvable book metadata (e.g. text
     * search, all panels in error state).
     */
    updateLocator() {
        const el = document.getElementById("locator-text");
        if (!el) return;
        if (this._textMode || !this._panelMeta) {
            el.textContent = "";
            return;
        }
        const meta = this._panelMeta.find((m) => m.book) || null;
        if (!meta) {
            el.textContent = "";
            return;
        }
        const firstBody = this.output.querySelector(".panel-body");
        let verseStr = "";
        if (firstBody) {
            const anchor = this.topMostVerse(firstBody);
            if (anchor) verseStr = ":" + anchor.n;
        }
        el.textContent = `${meta.book} ${meta.chapter}${verseStr}`;
    }

    renderPanel({ sel, data, networkError }, textMode) {
        const header = `<header>${this.escape(sel.label)}</header>`;
        const wrap = (inner) =>
            `<section class="translation-result" data-lang="${sel.lang}">${header}<div class="panel-body">${inner}</div></section>`;

        if (networkError) {
            return wrap(`<div class="error">Request failed.</div>`);
        }
        if (data && data.error) {
            return wrap(`<div class="error">${this.escape(data.error)}</div>`);
        }
        if (textMode) {
            return wrap(this.renderTextMatches(data));
        }
        return wrap(this.renderVerses(data));
    }

    renderTextMatches(data) {
        const matches = data.matches;
        if (matches.length === 0) {
            return `<div class="error">No matches.</div>`;
        }
        const shown = matches.slice(0, MAX_TEXT_MATCHES);
        const list = shown
            .map(
                (m) =>
                    `<div class="match">` +
                    `<a href="${this.escape(m.link)}" target="_blank" rel="noopener">${this.escape(m.book)} ${this.escape(m.chapter)}:${this.escape(m.verse)}</a>` +
                    `<div class="text">${this.escape(stripHtml(m.text))}</div></div>`,
            )
            .join("");
        const count = `<div class="count">${matches.length} match${matches.length === 1 ? "" : "es"}</div>`;
        const more =
            matches.length > MAX_TEXT_MATCHES
                ? `<div class="more">+${matches.length - MAX_TEXT_MATCHES} more · refine your search to see all</div>`
                : "";
        return `${count}${list}${more}`;
    }

    /**
     * Normalize the API's three verses shapes (object | array | string) to
     * [{n, text}]. Some translations (notably KJV via this API) embed HTML
     * in the verse body — `<sup class="versenum">10 </sup>...`. When that
     * leading tag is present we extract the number from it; otherwise we
     * fall back to a plain "10." prefix, the response's object key, or the
     * array index. Any remaining HTML is stripped so it can't render as
     * literal angle-bracket text after escape().
     */
    parseVerses(data) {
        let verses = data.verses;
        if (typeof verses === "string") {
            verses = [verses];
        }
        if (typeof verses === "object" && !Array.isArray(verses)) {
            return Object.entries(verses).map(([key, raw]) => {
                const { n, body } = peelVerse(raw);
                return {
                    n: n == null ? parseInt(key, 10) : n,
                    text: body,
                };
            });
        }
        return verses.map((raw, i) => {
            const { n, body } = peelVerse(raw);
            return { n: n == null ? i + 1 : n, text: body };
        });
    }

    renderVerses(data) {
        const parsed = this.parseVerses(data);
        const title = `<div class="title">${this.escape(data.book)} ${this.escape(data.chapter)}</div>`;
        const verseHtml = parsed
            .map(
                (v) =>
                    `<div class="verse" data-v="${v.n}">` +
                    `<span class="v-num">${v.n}</span>` +
                    `<span class="v-text">${this.escape(v.text)}</span>` +
                    `</div>`,
            )
            .join("");
        return `${title}${verseHtml}`;
    }

    updateTitle(results, textMode, query) {
        if (textMode) {
            document.title = `Search: ${query}`;
            return;
        }
        const firstOk = results.find((r) => r.data && !r.data.error && r.data.book);
        if (firstOk) {
            document.title = `${firstOk.data.book} ${firstOk.data.chapter}`;
        }
    }

    /**
     * Wire up scroll synchronization between all `.translation-result` panels
     * currently rendered. When a panel scrolls, find its topmost-visible verse
     * (by data-v) and align the same-numbered verse in every other panel to
     * the same vertical offset within its panel body. A reentrancy guard
     * (`_syncing`) prevents handler feedback loops.
     */
    setupSyncScroll() {
        const bodies = [...this.output.querySelectorAll(".panel-body")];
        // Locator updates on every scroll regardless of panel count, so the
        // presentation-mode top bar reflects the current verse even when only
        // one translation is enabled.
        bodies.forEach((body) => {
            body.addEventListener("scroll", () => this.updateLocator());
        });
        if (bodies.length < 2) return;

        bodies.forEach((body) => {
            body.addEventListener("scroll", () => {
                if (this._syncing) return;
                const anchor = this.topMostVerse(body);
                if (!anchor) return;
                this._syncing = true;
                bodies.forEach((other) => {
                    if (other === body) return;
                    this.scrollToVerse(other, anchor.n, anchor.offset);
                });
                requestAnimationFrame(() => {
                    this._syncing = false;
                });
            });
        });
    }

    /**
     * Returns { n, offset } for the verse currently nearest the top of the
     * given scrollable container. `offset` is the verse's offset from the
     * container's top, in pixels, so the corresponding verse in another
     * panel can be aligned to the same offset.
     */
    topMostVerse(container) {
        const verses = container.querySelectorAll(".verse");
        if (verses.length === 0) return null;
        const containerRect = container.getBoundingClientRect();
        let best = null;
        verses.forEach((v) => {
            const rect = v.getBoundingClientRect();
            if (rect.bottom <= containerRect.top) return;
            const offset = rect.top - containerRect.top;
            if (best == null || Math.abs(offset) < Math.abs(best.offset)) {
                best = { n: v.dataset.v, offset };
            }
        });
        return best;
    }

    scrollToVerse(container, verseNumber, desiredOffset) {
        const target = container.querySelector(`.verse[data-v="${verseNumber}"]`);
        if (!target) return;
        const containerRect = container.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const currentOffset = targetRect.top - containerRect.top;
        container.scrollTop += currentOffset - desiredOffset;
    }

    escape(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }
}

const VERSENUM_SUP = /^<sup\b[^>]*class\s*=\s*"versenum"[^>]*>\s*(\d+)\s*<\/sup>\s*/i;
const HTML_TAG = /<[^>]*>/g;

/**
 * Returns { n, body } for a raw verse string in any shape this API emits:
 *   - "<sup class=\"versenum\">16 </sup>For God so loved..." → { n: 16, body: "For God so loved..." }
 *   - "16. For God so loved..."                              → { n: 16, body: "For God so loved..." }
 *   - "For God so loved..."                                  → { n: null, body: "For God so loved..." }
 * Any remaining HTML in the body is stripped so escape() doesn't turn
 * tags into visible angle-bracketed text on screen.
 */
function peelVerse(raw) {
    const text = String(raw);
    const sup = VERSENUM_SUP.exec(text);
    if (sup) {
        return { n: parseInt(sup[1], 10), body: stripHtml(text.slice(sup[0].length)) };
    }
    const lead = /^\s*(\d+)[.\s]/.exec(text);
    if (lead) {
        return { n: parseInt(lead[1], 10), body: stripHtml(text.replace(/^\s*\d+\.?\s*/, "")) };
    }
    return { n: null, body: stripHtml(text) };
}

function stripHtml(text) {
    return text.replace(HTML_TAG, "").trim();
}


export default Parser;
