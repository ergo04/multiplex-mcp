export type Theme = "light" | "dark"

const KEY = "theme"
const DARK_QUERY = "(prefers-color-scheme: dark)"

// Runs in <head> during parsing, so the right theme is there before first paint.
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${KEY}");var d=t==="dark"||(t!=="light"&&matchMedia("${DARK_QUERY}").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`

export function storedTheme(): Theme | undefined {
  try {
    const value = localStorage.getItem(KEY)
    return value === "light" || value === "dark" ? value : undefined
  } catch {
    return undefined
  }
}

export function systemTheme(): Theme {
  return matchMedia(DARK_QUERY).matches ? "dark" : "light"
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark")
}

export function saveTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // Private mode or blocked storage: the choice just won't survive a reload.
  }
}

export function watchSystemTheme(onChange: (theme: Theme) => void) {
  const media = matchMedia(DARK_QUERY)
  const listener = () => onChange(media.matches ? "dark" : "light")
  media.addEventListener("change", listener)
  return () => media.removeEventListener("change", listener)
}
