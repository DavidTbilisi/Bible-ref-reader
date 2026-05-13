// Fixture responses shaped like the live API:
// https://davidchincharashvii.pythonanywhere.com
//
// - parseReference: GET /api/search/<lang>/<ver>/<query>
//     → { book, chapter, verses } (verses may be object | array | string)
// - textSearch:     GET /api/textsearch/<lang>/<ver>/<term>
//     → { matches: [{ book, chapter, verse, text, link }] }
// - direct lookup:  GET /api/<lang>/<ver>/<book>[/<ch>[/<vs>[/<ve>]]]
//     → same as parseReference
// - errors: HTTP 404 with { error: "..." } body

const genesis1_10 = {
  book: 'დაბ',
  chapter: 1,
  verses: { 10: '10. და უწოდა ღმერთმა ხმელეთს მიწა.' },
};

const genesis1_10_en = {
  book: 'Genesis',
  chapter: 1,
  verses: ['10. And God called the dry land Earth.'],
};

const genesis1_10_ru = {
  book: 'Бытие',
  chapter: 1,
  verses: ['10. И назвал Бог сушу землею, а собрание вод назвал морями.'],
};

const genesis1_10_to_12 = {
  book: 'დაბ',
  chapter: 1,
  verses: {
    10: '10. და უწოდა ღმერთმა ხმელეთს მიწა.',
    11: '11. და თქვა ღმერთმა.',
    12: '12. და გამოიღო მიწამ.',
  },
};

const firstCorinthians5 = {
  book: '1კორ',
  chapter: 5,
  verses: { 1: '1. ყოვლადვე ისმის.' },
};

const psalm23_array = {
  book: 'ფსალმ',
  chapter: 23,
  verses: ['1. უფალია მწყემსი ჩემი.', '2. მწვანე ბალახზე დამაბრძანებს.'],
};

// Array-form response without leading verse numbers — exercises the
// "fall back to array index" branch in Parser.parseVerses.
const john3_no_numbers = {
  book: 'John',
  chapter: 3,
  verses: [
    'For God so loved the world.',
    'For God sent not his Son into the world.',
    'He that believeth on him is not condemned.',
  ],
};

const psalm23_string = {
  book: 'ფსალმ',
  chapter: 23,
  verses: '1. უფალია მწყემსი ჩემი, არაფერი მაკლია.',
};

const genesis1_full = {
  book: 'დაბ',
  chapter: 1,
  verses: { 1: '1. დასაბამში.', 2: '2. და.' },
};

const textSearchResults = {
  matches: [
    {
      book: 'Genesis',
      chapter: 1,
      verse: 1,
      text: 'In the beginning God created the heaven and the earth.',
      link: 'https://davidchincharashvii.pythonanywhere.com/api/en/kjv/1/1/1',
    },
    {
      book: 'John',
      chapter: 1,
      verse: 1,
      text: 'In the beginning was the Word.',
      link: 'https://davidchincharashvii.pythonanywhere.com/api/en/kjv/43/1/1',
    },
  ],
};

const textSearchEmpty = { matches: [] };

const apiError = { error: 'Chapter 99 does not exist in the Bible' };

// KJV-style response from the live API: verse number is wrapped in
// <sup class="versenum">N </sup> and the body may contain other HTML.
const john3_kjv_html = {
  book: 'John',
  chapter: 3,
  verses: {
    16: '<sup class="versenum">16 </sup>For God so loved <i>the</i> world.',
    17: '<sup class="versenum">17 </sup>For God sent not his Son.',
    18: '<sup class="versenum">18 </sup>He that believeth on him.',
  },
};

// Object-form response where the values have NO leading number — the parser
// must fall back to the object key as the verse number.
const genesis1_object_no_numbers = {
  book: 'Genesis',
  chapter: 1,
  verses: {
    1: 'In the beginning God created.',
    2: 'And the earth was without form.',
  },
};

// Text-search response with HTML inside a match body.
const textSearchHtml = {
  matches: [
    {
      book: 'John',
      chapter: 3,
      verse: 16,
      text: '<sup class="versenum">16 </sup>For God so loved the world.',
      link: 'https://davidchincharashvii.pythonanywhere.com/api/en/kjv/43/3/16',
    },
  ],
};

module.exports = {
  genesis1_10,
  genesis1_10_en,
  genesis1_10_ru,
  genesis1_10_to_12,
  firstCorinthians5,
  psalm23_array,
  psalm23_string,
  genesis1_full,
  john3_no_numbers,
  john3_kjv_html,
  genesis1_object_no_numbers,
  textSearchResults,
  textSearchHtml,
  textSearchEmpty,
  apiError,
};
