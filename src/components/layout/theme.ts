// Theme storage key and the inline script that applies a saved theme before first paint (no flash).
export const THEME_KEY = "oneatlas:theme";

/**
 * Runs inline in <head> before first paint, so a saved light/dark choice never flashes the other theme.
 * No attribute (first visit) = CSS follows prefers-color-scheme.
 */
export const themeInitScript = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
