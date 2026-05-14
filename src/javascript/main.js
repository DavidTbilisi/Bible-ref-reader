import Bible from "./Bible.js";
import Parser from "./Parser.js";
import KeyNav from "./keynav.js";

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
    const root = document.documentElement;
    const input = document.getElementById("search");

    function hideSearchBar() {
        root.classList.remove("searching");
        input.blur();
    }

    function exitPresentation() {
        hideSearchBar();
        setMode("reading");
    }

    document.getElementById("presentation-toggle").addEventListener("click", () => {
        if (root.dataset.mode === "presentation") exitPresentation();
        else setMode("presentation");
    });

    // In presentation mode, any printable key with no modifier pops the
    // search bar and starts a fresh query with that keystroke. Escape hides
    // the bar (preserving results); a second Escape exits presentation.
    document.addEventListener("keydown", (e) => {
        if (root.dataset.mode !== "presentation") return;
        if (e.key === "Escape") {
            if (root.classList.contains("searching")) {
                hideSearchBar();
                e.preventDefault();
            } else {
                exitPresentation();
            }
            return;
        }
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key.length !== 1) return;
        if (document.activeElement === input) return;
        e.preventDefault();
        root.classList.add("searching");
        input.value = e.key;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
        input.dispatchEvent(new Event("keyup"));
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

new KeyNav(document.getElementById("search"));
