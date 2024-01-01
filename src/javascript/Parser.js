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
        let ref, bookId=1, bookName="დაბ", chapter=1, verseStart=1, verseEnd=1;


        if (reference) {
            let regex = /([a-zA-Zა-ჰ]+)\s*(\d+)?:?(\d+)?-?(\d+)?,?.*(\d+)?/;
            [ref, bookName, chapter, verseStart, verseEnd] = reference.match(regex);
            bookId = this.bookToID(bookName);
        } else { return };

        let toReturn = {
            bookId,
            bookName,
            chapter: chapter?parseInt(chapter):1,
            verseStart: verseStart?parseInt(verseStart):1,
            verseEnd: verseEnd?parseInt(verseEnd):undefined
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

    show() {
        let converted =  this.convertInput();
        this.showLoading();
        if (converted) {
            this.bible.getVerses(converted.bookId, converted.chapter, converted.verseStart, converted.verseEnd).then(data => {
                this.showVerses(data);
            }).catch(err => {
                this.showNoResults();
                console.log(err);
            });
        }
    }

    showVerses(data) {
        let html = `<div class="title">${data.book} ${data.chapter}</div>`;
        data.verses.forEach(verse => {
            html += `<div class="verse">${verse}</div>`;
        });
        this.output.innerHTML = html;
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