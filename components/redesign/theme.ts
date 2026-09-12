"use client";
import { useSyncExternalStore } from "react";
export type HiveTheme = "light" | "dark";
const key = "hive-redesign-theme";
const event = "hive-theme-change";
let transientChoice: HiveTheme | undefined;
function readTheme(): HiveTheme {
    if (transientChoice)
        return transientChoice;
    try {
        const saved = localStorage.getItem(key);
        if (saved === "light" || saved === "dark")
            return saved;
    }
    catch { /* The system preference still works when storage is unavailable. */ }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function subscribe(callback: () => void) {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
        document.documentElement.dataset.hiveTheme = readTheme();
        callback();
    };
    media.addEventListener("change", sync);
    window.addEventListener("storage", sync);
    window.addEventListener(event, callback);
    return () => {
        media.removeEventListener("change", sync);
        window.removeEventListener("storage", sync);
        window.removeEventListener(event, callback);
    };
}
export function useHiveTheme() {
    const theme = useSyncExternalStore(subscribe, readTheme, () => "light" as const);
    const toggle = () => {
        const next = theme === "dark" ? "light" : "dark";
        document.documentElement.dataset.hiveTheme = next;
        try {
            localStorage.setItem(key, next);
        }
        catch {
            transientChoice = next;
        }
        window.dispatchEvent(new Event(event));
    };
    return { theme, toggle };
}
