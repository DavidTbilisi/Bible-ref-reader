import Bible from "./Bible.js";
import Parser from "./Parser.js";


const bible = new Bible();
const parser = new Parser({
    inputSelector: "input",
    outputSelector: ".result",
    bible: new Bible()
});

