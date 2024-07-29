import books from "./books.js";

class Parser {
    constructor({ inputSelector, outputSelector, bible}) {
        this.input = document.querySelector(inputSelector);
        this.output = document.querySelector(outputSelector);
        this.bible = bible;
        this.input.addEventListener("keyup", this.show.bind(this));
        this.books = books;
    }

    convertInput () {
        let reference = this.input.value;
        let ref, bookId=1, bookName="დაბ", chapter, verseStart, verseEnd;


        if (reference) {
            let regex = /(\d?[a-zA-Zა-ჰ]+)\s*(\d+)?:?(\d+)?-?(\d+)?,?.*(\d+)?/;
            [ref, bookName, chapter, verseStart, verseEnd] = reference.match(regex);
            bookId = this.bookToID(bookName);
        } else { return };

        let toReturn = {
            bookId,
            bookName,
            chapter: chapter?parseInt(chapter):null,
            verseStart: verseStart?parseInt(verseStart):null,
            verseEnd: verseEnd?parseInt(verseEnd):null
        };

        return toReturn;
    }

    bookToID(bookName) {
        for (let i = 0; i < books.length; i++) {
            if (books[i].name === bookName || books[i].synonyms.includes(bookName)) {
                return i + 1; // Returns the index + 1 as book ID
            }
        }
        return "Invalid Book Name";
    }

    cleanData(data) {
        let cleanData =  Object.entries(data).filter(([key, value]) => value !== null)
        cleanData = Object.fromEntries(cleanData); // convert back to object
        // cleanData = Object.values(cleanData) //  convert to array
        return cleanData;
    }

    show() {
        let converted =  this.convertInput();
        this.showLoading();
        if (converted) {
            // filter values that are not null
            
            let convertedClean = this.cleanData(converted);

            this.bible.getVerses(convertedClean).then(data => {
                this.showVerses(data);
            }).catch(err => {
                this.showNoResults();
                console.log(err);
            });
        }
    }

    showVerses(data) {
        let html = `<div class="title">${data.book} ${data.chapter}</div>`;

        if (typeof data.verses === "object" && !Array.isArray(data.verses)) {
            data.verses = Object.values(data.verses);
        } else if (typeof data.verses === "string") {
            data.verses = [data.verses];
        }

        data.verses.forEach(verse => {
            html += `<div class="verse">${verse}</div>`;
        });
        this.output.innerHTML = html;
        let firstVerse = data.verses[0][0];
        let lastVerse = data.verses[data.verses.length - 1][0];
        document.title = `${data.book} ${data.chapter}:${firstVerse}-${lastVerse}`
    }

    showLoading() {
        let html = `<div class="title">Loading...</div>`;
        this.output.innerHTML = html;
    }

    showNoResults() {
        let html = `<div class="title">No Results</div>`;
        this.output.innerHTML = html;
    }
}


export default Parser;