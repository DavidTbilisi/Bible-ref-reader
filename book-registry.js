/*
Multilingual book registry.

Direct lookup via /api/<lang>/<ver>/<bookId>/<ch>/<vs>/<ve> is far more
robust than /api/search/, whose per-translation synonym tables are
incomplete (the live KJV parser accepts "Gen" but rejects "Genesis";
the Russian parser rejects most spellings we'd produce client-side).

So we parse the reference here, resolve the book to a numeric ID for
each target language's canon, and use direct lookup.

Two canon orderings are in play:
  - Western (used by en/kjv, en/asv, …, ru/rusv, ru/bti): the standard
    Protestant 66-book order.
  - Eastern / Georgian Orthodox (used by ka/geo, ka/orthodox): same OT,
    but the NT places the Catholic Epistles (James, Peter, John, Jude)
    BEFORE the Pauline letters. So Romans is enId 45, kaId 52.

OT books (1-39) align in both canons. NT books (40-66) diverge.
*/

const BOOKS = [
    // === Old Testament (kaId === enId === ruId) ===
    { id: 1,  kaId: 1,  ka: "დაბ",   en: "Genesis",        ru: "Бытие",          kaSyn: ["დაბადება"],           enSyn: ["Gen", "Gn"],          ruSyn: ["Быт"] },
    { id: 2,  kaId: 2,  ka: "გამ",   en: "Exodus",         ru: "Исход",          kaSyn: ["გამოსვლა"],           enSyn: ["Exod", "Ex"],         ruSyn: ["Исх"] },
    { id: 3,  kaId: 3,  ka: "ლევ",   en: "Leviticus",      ru: "Левит",          kaSyn: ["ლევიანნი"],          enSyn: ["Lev", "Lv"],          ruSyn: ["Лев"] },
    { id: 4,  kaId: 4,  ka: "რიცხ",   en: "Numbers",        ru: "Числа",          kaSyn: ["რიცხვნი"],            enSyn: ["Num", "Nu"],          ruSyn: ["Чис"] },
    { id: 5,  kaId: 5,  ka: "რჯლ",   en: "Deuteronomy",    ru: "Второзаконие",   kaSyn: ["მეორე რჯული"],       enSyn: ["Deut", "Dt"],         ruSyn: ["Втор"] },
    { id: 6,  kaId: 6,  ka: "იესო",   en: "Joshua",         ru: "Иисус Навин",    kaSyn: ["იესო ნავე"],         enSyn: ["Josh", "Jos"],        ruSyn: ["Нав"] },
    { id: 7,  kaId: 7,  ka: "მსაჯ",   en: "Judges",         ru: "Книга Судей",    kaSyn: ["მსაჯულნი"],          enSyn: ["Judg", "Jdg"],        ruSyn: ["Суд"] },
    { id: 8,  kaId: 8,  ka: "რუთ",   en: "Ruth",           ru: "Руфь",           kaSyn: [],                     enSyn: ["Ru"],                 ruSyn: ["Руф"] },
    { id: 9,  kaId: 9,  ka: "1მეფ",  en: "1 Samuel",       ru: "1 Царств",       kaSyn: ["პირველი მეფეთა"],    enSyn: ["1Sam", "1 Sam", "I Sam"], ruSyn: ["1Цар", "1 Цар"] },
    { id: 10, kaId: 10, ka: "2მეფ",  en: "2 Samuel",       ru: "2 Царств",       kaSyn: ["მეორე მეფეთა"],      enSyn: ["2Sam", "2 Sam", "II Sam"], ruSyn: ["2Цар", "2 Цар"] },
    { id: 11, kaId: 11, ka: "3მეფ",  en: "1 Kings",        ru: "3 Царств",       kaSyn: ["მესამე მეფეთა"],     enSyn: ["1Kgs", "1 Kgs", "I Kgs"], ruSyn: ["3Цар", "3 Цар"] },
    { id: 12, kaId: 12, ka: "4მეფ",  en: "2 Kings",        ru: "4 Царств",       kaSyn: ["მეოთხე მეფეთა"],     enSyn: ["2Kgs", "2 Kgs", "II Kgs"], ruSyn: ["4Цар", "4 Цар"] },
    { id: 13, kaId: 13, ka: "1ნეშტ", en: "1 Chronicles",   ru: "1 Паралипоменон", kaSyn: [],                    enSyn: ["1Chr", "1 Chr", "I Chr"], ruSyn: ["1Пар", "1 Пар"] },
    { id: 14, kaId: 14, ka: "2ნეშტ", en: "2 Chronicles",   ru: "2 Паралипоменон", kaSyn: [],                    enSyn: ["2Chr", "2 Chr", "II Chr"], ruSyn: ["2Пар", "2 Пар"] },
    { id: 15, kaId: 15, ka: "ეზრ",   en: "Ezra",           ru: "Ездры",          kaSyn: ["ეზრა"],               enSyn: ["Ezr"],                ruSyn: ["Езд"] },
    { id: 16, kaId: 16, ka: "ნეემ",  en: "Nehemiah",       ru: "Неемии",         kaSyn: ["ნეემია"],             enSyn: ["Neh"],                ruSyn: ["Неем"] },
    { id: 17, kaId: 17, ka: "ესთ",   en: "Esther",         ru: "Есфирь",         kaSyn: ["ესთერი"],             enSyn: ["Est"],                ruSyn: ["Есф"] },
    { id: 18, kaId: 18, ka: "იობ",   en: "Job",            ru: "Иов",            kaSyn: [],                     enSyn: ["Jb"],                 ruSyn: [] },
    { id: 19, kaId: 19, ka: "ფსალმ",  en: "Psalms",         ru: "Псалтирь",       kaSyn: ["ფსალმუნი", "Ps"],    enSyn: ["Ps", "Psalm"],        ruSyn: ["Пс"] },
    { id: 20, kaId: 20, ka: "იგავ",  en: "Proverbs",       ru: "Притчи",         kaSyn: ["იგავნი"],             enSyn: ["Prov", "Pr"],         ruSyn: ["Прит"] },
    { id: 21, kaId: 21, ka: "ეკლ",   en: "Ecclesiastes",   ru: "Екклесиаст",     kaSyn: ["ეკლესიასტე"],         enSyn: ["Eccl", "Ec"],         ruSyn: ["Еккл"] },
    { id: 22, kaId: 22, ka: "ქებ",   en: "Song of Solomon", ru: "Песни Песней",  kaSyn: ["ქებათა ქება"],       enSyn: ["Song", "SS", "Cant"], ruSyn: ["Песн"] },
    { id: 23, kaId: 23, ka: "ეს",    en: "Isaiah",         ru: "Исаия",          kaSyn: ["ესაია"],              enSyn: ["Isa", "Is"],          ruSyn: ["Ис"] },
    { id: 24, kaId: 24, ka: "იერ",   en: "Jeremiah",       ru: "Иеремия",        kaSyn: ["იერემია"],            enSyn: ["Jer"],                ruSyn: ["Иер"] },
    { id: 25, kaId: 25, ka: "გოდ",   en: "Lamentations",   ru: "Плач Иеремии",   kaSyn: ["გოდება"],             enSyn: ["Lam"],                ruSyn: ["Плач"] },
    { id: 26, kaId: 26, ka: "ეზეკ",  en: "Ezekiel",        ru: "Иезекииль",      kaSyn: ["ეზეკიელი"],           enSyn: ["Ezek", "Ez"],         ruSyn: ["Иез"] },
    { id: 27, kaId: 27, ka: "დან",   en: "Daniel",         ru: "Даниил",         kaSyn: ["დანიელი"],            enSyn: ["Dan", "Dn"],          ruSyn: ["Дан"] },
    { id: 28, kaId: 28, ka: "ოს",    en: "Hosea",          ru: "Осия",           kaSyn: ["ოსია"],               enSyn: ["Hos"],                ruSyn: ["Ос"] },
    { id: 29, kaId: 29, ka: "იოელ",  en: "Joel",           ru: "Иоиль",          kaSyn: [],                     enSyn: ["Jl"],                 ruSyn: ["Иоил"] },
    { id: 30, kaId: 30, ka: "ამოს",  en: "Amos",           ru: "Амос",           kaSyn: [],                     enSyn: ["Am"],                 ruSyn: ["Ам"] },
    { id: 31, kaId: 31, ka: "აბდ",   en: "Obadiah",        ru: "Авдий",          kaSyn: ["აბდია"],              enSyn: ["Obad", "Ob"],         ruSyn: ["Авд"] },
    { id: 32, kaId: 32, ka: "იონ",   en: "Jonah",          ru: "Иона",           kaSyn: ["იონა"],               enSyn: ["Jon"],                ruSyn: ["Ион"] },
    { id: 33, kaId: 33, ka: "მიქ",   en: "Micah",          ru: "Михей",          kaSyn: ["მიქია"],              enSyn: ["Mic"],                ruSyn: ["Мих"] },
    { id: 34, kaId: 34, ka: "ნაუმ",  en: "Nahum",          ru: "Наум",           kaSyn: [],                     enSyn: ["Nah", "Na"],          ruSyn: [] },
    { id: 35, kaId: 35, ka: "აბაკ",  en: "Habakkuk",       ru: "Аввакум",        kaSyn: ["აბაკუმი"],            enSyn: ["Hab"],                ruSyn: ["Авв"] },
    { id: 36, kaId: 36, ka: "სოფ",   en: "Zephaniah",      ru: "Софония",        kaSyn: ["სოფონია"],            enSyn: ["Zeph", "Zep"],        ruSyn: ["Соф"] },
    { id: 37, kaId: 37, ka: "ანგ",   en: "Haggai",         ru: "Аггей",          kaSyn: ["ანგია"],              enSyn: ["Hag", "Hg"],          ruSyn: ["Агг"] },
    { id: 38, kaId: 38, ka: "ზაქ",   en: "Zechariah",      ru: "Захария",        kaSyn: ["ზაქარია"],            enSyn: ["Zech", "Zec"],        ruSyn: ["Зах"] },
    { id: 39, kaId: 39, ka: "მალ",   en: "Malachi",        ru: "Малахия",        kaSyn: ["მალაქია"],            enSyn: ["Mal"],                ruSyn: ["Мал"] },

    // === New Testament — kaId diverges from id for Catholic-Epistles-first ordering ===
    // Gospels + Acts: kaId === id
    { id: 40, kaId: 40, ka: "მათ",   en: "Matthew",        ru: "От Матфея",      kaSyn: ["მათე"],               enSyn: ["Matt", "Mt"],         ruSyn: ["Мф", "Матф"] },
    { id: 41, kaId: 41, ka: "მარკ",  en: "Mark",           ru: "От Марка",       kaSyn: ["მარკოზი"],            enSyn: ["Mk"],                 ruSyn: ["Мк"] },
    { id: 42, kaId: 42, ka: "ლუკ",   en: "Luke",           ru: "От Луки",        kaSyn: ["ლუკა"],               enSyn: ["Lk"],                 ruSyn: ["Лк"] },
    { id: 43, kaId: 43, ka: "იოან",  en: "John",           ru: "От Иоанна",      kaSyn: ["იოანე"],              enSyn: ["Jn", "Jhn"],          ruSyn: ["Ин"] },
    { id: 44, kaId: 44, ka: "საქმე", en: "Acts",           ru: "Деяния",         kaSyn: ["საქმეები"],           enSyn: ["Ac"],                 ruSyn: ["Деян"] },
    // Pauline letters: Western has them next (45-58); Georgian Orthodox places them AFTER the Catholic Epistles
    { id: 45, kaId: 52, ka: "რომ",   en: "Romans",         ru: "Римлянам",       kaSyn: ["რომაელთა"],           enSyn: ["Rom", "Rm"],          ruSyn: ["Рим"] },
    { id: 46, kaId: 53, ka: "1კორ",  en: "1 Corinthians",  ru: "1 Коринфянам",   kaSyn: [],                     enSyn: ["1Cor", "1 Cor", "I Cor"], ruSyn: ["1Кор", "1 Кор"] },
    { id: 47, kaId: 54, ka: "2კორ",  en: "2 Corinthians",  ru: "2 Коринфянам",   kaSyn: [],                     enSyn: ["2Cor", "2 Cor", "II Cor"], ruSyn: ["2Кор", "2 Кор"] },
    { id: 48, kaId: 55, ka: "გალ",   en: "Galatians",      ru: "Галатам",        kaSyn: ["გალატელთა"],          enSyn: ["Gal"],                ruSyn: ["Гал"] },
    { id: 49, kaId: 56, ka: "ეფეს",  en: "Ephesians",      ru: "Ефесянам",       kaSyn: ["ეფესელთა"],           enSyn: ["Eph"],                ruSyn: ["Еф"] },
    { id: 50, kaId: 57, ka: "ფილიპ", en: "Philippians",    ru: "Филиппийцам",    kaSyn: ["ფილიპელთა"],          enSyn: ["Phil", "Php"],        ruSyn: ["Флп"] },
    { id: 51, kaId: 58, ka: "კოლ",   en: "Colossians",     ru: "Колоссянам",     kaSyn: ["კოლასელთა"],          enSyn: ["Col"],                ruSyn: ["Кол"] },
    { id: 52, kaId: 59, ka: "1თეს",  en: "1 Thessalonians", ru: "1 Фессалоникийцам", kaSyn: [],                 enSyn: ["1Thess", "1 Thess", "I Thess"], ruSyn: ["1Фес", "1 Фес"] },
    { id: 53, kaId: 60, ka: "2თეს",  en: "2 Thessalonians", ru: "2 Фессалоникийцам", kaSyn: [],                 enSyn: ["2Thess", "2 Thess", "II Thess"], ruSyn: ["2Фес", "2 Фес"] },
    { id: 54, kaId: 61, ka: "1ტიმ",  en: "1 Timothy",      ru: "1 Тимофею",      kaSyn: [],                     enSyn: ["1Tim", "1 Tim", "I Tim"], ruSyn: ["1Тим", "1 Тим"] },
    { id: 55, kaId: 62, ka: "2ტიმ",  en: "2 Timothy",      ru: "2 Тимофею",      kaSyn: [],                     enSyn: ["2Tim", "2 Tim", "II Tim"], ruSyn: ["2Тим", "2 Тим"] },
    { id: 56, kaId: 63, ka: "ტიტ",   en: "Titus",          ru: "Титу",           kaSyn: ["ტიტე"],               enSyn: ["Tit"],                ruSyn: ["Тит"] },
    { id: 57, kaId: 64, ka: "ფილ",   en: "Philemon",       ru: "Филимону",       kaSyn: ["ფილიმონი"],           enSyn: ["Phlm", "Philem"],     ruSyn: ["Флм"] },
    { id: 58, kaId: 65, ka: "ებრ",   en: "Hebrews",        ru: "Евреям",         kaSyn: ["ებრაელთა"],           enSyn: ["Heb"],                ruSyn: ["Евр"] },
    // Catholic Epistles: Western has them after Hebrews (59-65); Georgian has them BEFORE Romans (45-51)
    { id: 59, kaId: 45, ka: "იაკ",   en: "James",          ru: "Иакова",         kaSyn: ["იაკობი"],             enSyn: ["Jas"],                ruSyn: ["Иак"] },
    { id: 60, kaId: 46, ka: "1პეტრ", en: "1 Peter",        ru: "1 Петра",        kaSyn: [],                     enSyn: ["1Pet", "1 Pet", "I Pet"], ruSyn: ["1Пет", "1 Пет"] },
    { id: 61, kaId: 47, ka: "2პეტრ", en: "2 Peter",        ru: "2 Петра",        kaSyn: [],                     enSyn: ["2Pet", "2 Pet", "II Pet"], ruSyn: ["2Пет", "2 Пет"] },
    { id: 62, kaId: 48, ka: "1იოან", en: "1 John",         ru: "1 Иоанна",       kaSyn: [],                     enSyn: ["1John", "1 John", "I John", "1Jn"], ruSyn: ["1Ин", "1 Ин"] },
    { id: 63, kaId: 49, ka: "2იოან", en: "2 John",         ru: "2 Иоанна",       kaSyn: [],                     enSyn: ["2John", "2 John", "II John", "2Jn"], ruSyn: ["2Ин", "2 Ин"] },
    { id: 64, kaId: 50, ka: "3იოან", en: "3 John",         ru: "3 Иоанна",       kaSyn: [],                     enSyn: ["3John", "3 John", "III John", "3Jn"], ruSyn: ["3Ин", "3 Ин"] },
    { id: 65, kaId: 51, ka: "იუდ",   en: "Jude",           ru: "Иуды",           kaSyn: ["იუდა"],               enSyn: ["Jud", "Jd"],          ruSyn: ["Иуд"] },
    // Revelation: kaId === id === 66 in both
    { id: 66, kaId: 66, ka: "გამოცხ", en: "Revelation",   ru: "Откровение",     kaSyn: ["გამოცხადება"],        enSyn: ["Rev", "Rv", "Apoc"],  ruSyn: ["Откр"] },
];

const BOOK_INDEX = (() => {
    const map = new Map();
    for (const book of BOOKS) {
        const names = [book.ka, book.en, book.ru, ...book.kaSyn, ...book.enSyn, ...book.ruSyn];
        for (const name of names) {
            map.set(normalize(name), book);
        }
    }
    return map;
})();

function normalize(s) {
    return String(s).toLowerCase().replace(/\s+/g, "").replace(/\./g, "");
}

/** Returns the BOOKS entry whose name or any synonym matches the token, or null. */
function findBook(token) {
    return BOOK_INDEX.get(normalize(token)) || null;
}

/** Returns the book's numeric ID for the given language, or null if unknown. */
function bookIdFor(book, lang) {
    if (lang === "ka") return book.kaId;
    return book.id;
}

/**
 * Parses "<book> [<chapter>[:<verseStart>[-<verseEnd>]]]" into
 *   { book, chapter?, verseStart?, verseEnd? }
 * Returns null if the book token can't be recognized or the chapter/verse
 * portion is malformed (e.g. contains a comma — multi-range references
 * are handled by /api/search/ on the server instead).
 */
function parseQuery(query) {
    const split = splitBookFromRest(query);
    if (!split) return null;
    const book = findBook(split.book);
    if (!book) return null;

    const rest = split.rest.replace(/\s+/g, "");
    if (!rest) return { book };

    const m = /^(\d+)(?::(\d+)(?:-(\d+))?)?$/.exec(rest);
    if (!m) return null;

    const out = { book, chapter: parseInt(m[1], 10) };
    if (m[2]) out.verseStart = parseInt(m[2], 10);
    if (m[3]) out.verseEnd = parseInt(m[3], 10);
    return out;
}

/**
 * Splits "1კორ 5:1-3" → { book: "1კორ", rest: "5:1-3" }.
 * Returns null if the query doesn't start with a recognizable book token.
 */
function splitBookFromRest(query) {
    const trimmed = String(query).trim();
    const m = /^(\d?\s*[a-zA-Zა-ჰА-Яа-яЁё]+(?:\s+[a-zA-Zა-ჰА-Яа-яЁё]+)*)\s*(.*)$/.exec(trimmed);
    if (!m) return null;
    return { book: m[1].trim(), rest: m[2].trim() };
}


export { BOOKS, findBook, bookIdFor, parseQuery, splitBookFromRest };
