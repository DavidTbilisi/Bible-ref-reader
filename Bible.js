/*
Get Bible Text
URL: /bible
Method: GET
URL Params:
lang: Language code (e.g., "en" for English).
version: Bible version code (e.g., "kjv" for King James Version).
book: Book number (e.g., 1 for Genesis).
chapter: Chapter number.
verse_start: (Optional) Starting verse number.
verse_end: (Optional) Ending verse number.
extra_verses: (Optional) Additional verses.
*/


class Bible {
    constructor() {
        this.baseURL = `https://davidchincharashvii.pythonanywhere.com/api`;
        this.bibleVersion = "geo";
        this.bibleLanguage = "ka";
        this.chapter = 1;
        this.book = 1;
        this.startVerse = 1;
        this.endVerse = this.startVerse;
        this.books = [];

        this.setLanguage();
        this.setVersion();
    }

    setVersion(version = "geo") {
        this.bibleVersion = version;
        this.baseURL = `https://davidchincharashvii.pythonanywhere.com/api` + `/${this.bibleLanguage}/${this.bibleVersion}`;
    }

    setLanguage(language = "ka") {
        this.bibleLanguage = language;
        this.baseURL = `https://davidchincharashvii.pythonanywhere.com/api` + `/${this.bibleLanguage}/${this.bibleVersion}`;
    }

    async getVerses({bookId, chapter, verseStart, verseEnd }) {
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
}


export default Bible;
