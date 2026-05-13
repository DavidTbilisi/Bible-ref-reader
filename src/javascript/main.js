import Bible from "./Bible.js";
import Parser from "./Parser.js";

const THEMES = ["vellum", "compline"];
const STORAGE_KEY = "bible.theme";

function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
}

function initialTheme() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (THEMES.includes(stored)) return stored;
    return matchMedia("(prefers-color-scheme: dark)").matches ? "compline" : "vellum";
}

function setMode(mode) {
    document.documentElement.dataset.mode = mode;
}

function setupTheme() {
    applyTheme(initialTheme());
    document.getElementById("theme-toggle").addEventListener("click", () => {
        const next = document.documentElement.dataset.theme === "compline" ? "vellum" : "compline";
        applyTheme(next);
    });
}

function setupPresentation() {
    document.getElementById("presentation-toggle").addEventListener("click", () => {
        const next = document.documentElement.dataset.mode === "presentation" ? "reading" : "presentation";
        setMode(next);
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && document.documentElement.dataset.mode === "presentation") {
            setMode("reading");
        }
    });
}

setupTheme();
setupPresentation();

const parser = new Parser({
    inputSelector: "#search",
    outputSelector: "#result",
    controlsSelector: "#translations",
    bible: new Bible(),
});
