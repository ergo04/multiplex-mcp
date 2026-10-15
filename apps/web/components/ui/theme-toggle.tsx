"use client"

import { Moon, Sun } from "lucide-react"
import { useLayoutEffect } from "react"
import { buttonClass } from "@/lib/button"
import {
  applyTheme,
  saveTheme,
  storedTheme,
  systemTheme,
  watchSystemTheme,
} from "@/lib/theme"

export function ThemeToggle() {
  // The inline script already set the class; in development React's remount
  // resets <html> attributes, so it is applied again here.
  useLayoutEffect(() => {
    applyTheme(storedTheme() ?? systemTheme())
    return watchSystemTheme((theme) => {
      if (!storedTheme()) applyTheme(theme)
    })
  }, [])

  function toggle() {
    const next = document.documentElement.classList.contains("dark")
      ? "light"
      : "dark"
    saveTheme(next)
    applyTheme(next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between light and dark theme"
      className={buttonClass({ variant: "ghost", size: "icon" })}
    >
      <Sun className="dark:hidden" />
      <Moon className="hidden dark:block" />
    </button>
  )
}
