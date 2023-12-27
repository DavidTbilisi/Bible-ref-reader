// https://davidchincharashvii.pythonanywhere.com/api/ka/geo/1/1/1/8
function bibleBookToID(bookName) {
  const books = {
    Gen: 1,
    Exo: 2,
    Lev: 3,
    Num: 4,
    Deu: 5,
    Jos: 6,
    Jdg: 7,
    Rut: 8,
    "1Sa": 9,
    "2Sa": 10,
    "1Ki": 11,
    "2Ki": 12,
    "1Ch": 13,
    "2Ch": 14,
    Ezr: 15,
    Neh: 16,
    Est: 17,
    Job: 18,
    Psa: 19,
    Pro: 20,
    Ecc: 21,
    Son: 22,
    Isa: 23,
    Jer: 24,
    Lam: 25,
    Eze: 26,
    Dan: 27,
    Hos: 28,
    Joe: 29,
    Amo: 30,
    Oba: 31,
    Jon: 32,
    Mic: 33,
    Nah: 34,
    Hab: 35,
    Zep: 36,
    Hag: 37,
    Zec: 38,
    Mal: 39,
    Mat: 40,
    Mar: 41,
    Luk: 42,
    Joh: 43,
    Act: 44,
    Rom: 45,
    "1Co": 46,
    "2Co": 47,
    Gal: 48,
    Eph: 49,
    Phi: 50,
    Col: 51,
    "1Th": 52,
    "2Th": 53,
    "1Ti": 54,
    "2Ti": 55,
    Tit: 56,
    Phm: 57,
    Heb: 58,
    Jam: 59,
    "1Pe": 60,
    "2Pe": 61,
    "1Jo": 62,
    "2Jo": 63,
    "3Jo": 64,
    Jud: 65,
    Rev: 66
  };
  return books[bookName] || "Invalid Book Name";
}

function parseBibleReference(reference) {
  let verses = [1,1];
  const parts = reference.split(" ");
  const bookName = parts[0];
  const chapterAndVerse = parts[1].split(":");
  // verses are optional
  if (chapterAndVerse[1].includes("-")) {
    verses = chapterAndVerse[1].split("-");
  }

  return {
    book_id: bibleBookToID(bookName),
    chapter_num: parseInt(chapterAndVerse[0]),
    start_verse_num: parseInt(verses[0]),
    end_verse_num: parseInt(verses[1])
  };
}

let search_input = document.querySelector("input");
search_input.addEventListener("blur", function () {
  let parsedData = parseBibleReference(search_input.value);
  parse(parsedData);
});

let base_url = "https://davidchincharashvii.pythonanywhere.com/api";
let lang = "ka";
let version = "geo";

function parse({ book_id, chapter_num, start_verse_num, end_verse_num }) {
  let url = `${base_url}/${lang}/${version}/${book_id}/${chapter_num}/${start_verse_num}/${end_verse_num}`;
  console.log(url);

  axios.get(url)
    .then(function (response) {
      console.log(response.data);
      let title = `${response.data.book_name} ${response.data.chapter_num}:${response.data.start_verse_num}-${response.data.end_verse_num}`;
      let verses = response.data.verses;
      show(title, verses);
    })
    .catch(function (error) {
      console.log(error);
    });
}

function show(title, verses) {
  let result = document.querySelector(".result");
  let html = `<div class="title">${title}</div>`;
  verses.forEach(verse => {
    html += `<div class="verse">${verse}</div>`;
  });
  result.innerHTML = html;
}

function showLoading() {
  let result = document.querySelector(".result");
  let html = `<div class="loading">Loading...</div>`;
  result.innerHTML = html;
}

function showError() {
  let result = document.querySelector(".result");
  let html = `<div class="error">Error</div>`;
  result.innerHTML = html;
}

