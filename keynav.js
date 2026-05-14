/*
Vim-like keyboard shortcuts for fast chapter/book navigation.

Active only when the search input is NOT focused. Operates by rewriting
#search and dispatching a keyup, so the existing Parser pipeline picks it up.

Bindings:
  i       focus the search input (insert mode)
  j / k   next / previous chapter   (numeric prefix supported, e.g. 5j)
  ] / [   next / previous book      (lands on chapter 1)
  gg      first chapter of current book
  G       last chapter of current book   (12G → chapter 12)

Listener is in the capture phase so it intercepts keys before the
presentation-mode "any printable key pops the search bar" handler in main.js.
Keys we don't claim are allowed to bubble so that behaviour still works.
*/

import { BOOKS, findBook, splitBookFromRest } from "./book-registry.js";

const CHORD_TIMEOUT_MS = 600;

// Chapter counts keyed by Western-canon id (1..66). Used to clamp `j`/`G`.
// Verse counts vary across translations; chapter counts are stable enough.
const CHAPTER_COUNTS = {
    1: 50, 2: 40, 3: 27, 4: 36, 5: 34, 6: 24, 7: 21, 8: 4, 9: 31, 10: 24,
    11: 22, 12: 25, 13: 29, 14: 36, 15: 10, 16: 13, 17: 10, 18: 42, 19: 150, 20: 31,
    21: 12, 22: 8, 23: 66, 24: 52, 25: 5, 26: 48, 27: 12, 28: 14, 29: 3, 30: 9,
    31: 1, 32: 4, 33: 7, 34: 3, 35: 3, 36: 3, 37: 2, 38: 14, 39: 4, 40: 28,
    41: 16, 42: 24, 43: 21, 44: 28, 45: 16, 46: 16, 47: 13, 48: 6, 49: 6, 50: 4,
    51: 4, 52: 5, 53: 3, 54: 6, 55: 4, 56: 3, 57: 1, 58: 13, 59: 5, 60: 5,
    61: 3, 62: 5, 63: 1, 64: 1, 65: 1, 66: 22,
};

function scriptOf(token) {
    if (/[Ⴀ-ჿ]/.test(token)) return "ka";
    if (/[Ѐ-ӿ]/.test(token)) return "ru";
    return "en";
}

function nameFor(book, script) {
    return book[script] || book.en;
}

class KeyNav {
    constructor(input) {
        this.input = input;
        this.pending = "";    // numeric prefix buffer (e.g. "5" before "j")
        this.lastGAt = 0;     // timestamp of last 'g' for the gg chord
        document.addEventListener("keydown", this.onKeydown.bind(this), true);
    }

    onKeydown(e) {
        if (document.activeElement === this.input) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const key = e.key;

        if (key === "i") {
            this.consume(e);
            this.reset();
            this.input.focus();
            return;
        }

        const cur = this.parseCurrent();
        if (!cur) {
            // No reference to navigate from — bow out and let main.js's
            // presentation-mode handler (bubble phase) react to printable keys.
            this.reset();
            return;
        }

        if (/^[0-9]$/.test(key)) {
            this.pending += key;
            this.consume(e);
            return;
        }

        // 'g' is special: alone it arms the chord, paired it fires `gg → ch 1`.
        if (key === "g") {
            this.consume(e);
            const now = Date.now();
            if (now - this.lastGAt < CHORD_TIMEOUT_MS) {
                this.reset();
                this.commit({ ...cur, chapter: 1 });
            } else {
                this.lastGAt = now;
            }
            return;
        }

        const count = this.pending ? parseInt(this.pending, 10) : 0;
        this.reset();
        const target = this.targetFor(key, cur, count);
        if (!target) return;
        this.consume(e);
        this.commit(target);
    }

    targetFor(key, cur, count) {
        const n = Math.max(1, count);
        switch (key) {
            case "j": {
                const max = CHAPTER_COUNTS[cur.book.id] || 999;
                return { ...cur, chapter: Math.min(max, cur.chapter + n) };
            }
            case "k":
                return { ...cur, chapter: Math.max(1, cur.chapter - n) };
            case "]": {
                const idx = BOOKS.indexOf(cur.book);
                const next = BOOKS[Math.min(BOOKS.length - 1, idx + n)];
                return { book: next, chapter: 1, script: cur.script };
            }
            case "[": {
                const idx = BOOKS.indexOf(cur.book);
                const prev = BOOKS[Math.max(0, idx - n)];
                return { book: prev, chapter: 1, script: cur.script };
            }
            case "G": {
                const max = CHAPTER_COUNTS[cur.book.id] || 1;
                return { ...cur, chapter: count > 0 ? Math.min(max, count) : max };
            }
            default:
                return null;
        }
    }

    parseCurrent() {
        const raw = this.input.value;
        if (!raw || raw.startsWith("/")) return null;
        const split = splitBookFromRest(raw);
        if (!split) return null;
        const book = findBook(split.book);
        if (!book) return null;
        const rest = split.rest.replace(/\s+/g, "");
        const m = /^(\d+)(?::\d+(?:-\d+)?)?$/.exec(rest);
        const chapter = m ? parseInt(m[1], 10) : 1;
        return { book, chapter, script: scriptOf(split.book) };
    }

    commit({ book, chapter, script }) {
        this.input.value = `${nameFor(book, script)} ${chapter}`;
        this.input.dispatchEvent(new Event("keyup"));
    }

    consume(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    reset() {
        this.pending = "";
        this.lastGAt = 0;
    }
}

export default KeyNav;
