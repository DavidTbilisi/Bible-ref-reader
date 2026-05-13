/*
Multilingual Bible REST client.

Wraps three endpoints exposed by github.com/DavidTbilisi/Georgian_bible_api:

  - direct lookup    GET /api/<lang>/<ver>/<book>[/<ch>[/<vs>[/<ve>]]]
  - reference parser GET /api/search/<lang>/<ver>/<query>
  - full-text search GET /api/textsearch/<lang>/<ver>/<term>

Errors come back as { error: "..." } with HTTP 404 — callers should check
for a truthy `error` field rather than relying on response.ok.
*/

class Bible {
    constructor({ lang = "ka", version = "geo" } = {}) {
        this.host = "https://davidchincharashvii.pythonanywhere.com";
        this.bibleLanguage = lang;
        this.bibleVersion = version;
        this._refreshBase();
    }

    _refreshBase() {
        this.baseURL = `${this.host}/api/${this.bibleLanguage}/${this.bibleVersion}`;
    }

    setVersion(version = "geo") {
        this.bibleVersion = version;
        this._refreshBase();
    }

    setLanguage(language = "ka") {
        this.bibleLanguage = language;
        this._refreshBase();
    }

    async getVerses({ bookId, chapter, verseStart, verseEnd }) {
        this.book = bookId;
        this.chapter = chapter;
        this.startVerse = verseStart;
        this.endVerse = verseEnd;

        let url = `${this.baseURL}`;
        switch (Object.keys(arguments[0]).length) {
            case 3:
                url += `/${this.book}/${this.chapter}`;
                break;
            case 4:
                url += `/${this.book}/${this.chapter}/${this.startVerse}`;
                break;
            case 5:
                url += `/${this.book}/${this.chapter}/${this.startVerse}/${this.endVerse}`;
                break;
            default:
                break;
        }

        const response = await fetch(url);
        const data = await response.json();
        return data;
    }

    async parseReference(query, { lang, version } = {}) {
        const url = `${this.host}/api/search/${lang || this.bibleLanguage}/${version || this.bibleVersion}/${encodeURIComponent(query)}`;
        const response = await fetch(url);
        return response.json();
    }

    async textSearch(term, { lang, version } = {}) {
        const url = `${this.host}/api/textsearch/${lang || this.bibleLanguage}/${version || this.bibleVersion}/${encodeURIComponent(term)}`;
        const response = await fetch(url);
        return response.json();
    }
}


export default Bible;
