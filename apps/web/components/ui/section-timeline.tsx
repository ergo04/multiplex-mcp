"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/cn"
import { SECTIONS } from "@/lib/sections"
import { SectionLabel } from "@/components/ui/section-label"

const ROW = 2 // rem: every row is the same height, so the rail can be measured in rows

/**
 * The page's index as a timeline that stays beside the column: sections behind
 * you are filled in ink, the one you're reading carries the orange square.
 */
export function SectionTimeline() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const update = () => {
      // A section counts as current once its top passes a third of the screen.
      const line = window.innerHeight / 3
      let current = 0
      SECTIONS.forEach((section, index) => {
        const top = document
          .getElementById(section.id)
          ?.getBoundingClientRect().top
        if (top !== undefined && top <= line) current = index
      })
      setActive(current)
    }
    update()
    // An anchor in the URL scrolls after this first run, without a scroll event
    // reaching us in every browser.
    const settle = window.setTimeout(update, 200)
    window.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    window.addEventListener("hashchange", update)
    return () => {
      window.clearTimeout(settle)
      window.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
      window.removeEventListener("hashchange", update)
    }
  }, [])

  return (
    <nav
      aria-label="On this page"
      className="sticky top-20 hidden self-start py-16 sm:py-20 lg:block"
    >
      <SectionLabel>On this page</SectionLabel>
      <ol className="relative mt-5">
        <span
          aria-hidden
          className="absolute left-[5px] w-px bg-border"
          style={{ top: `${ROW / 2}rem`, bottom: `${ROW / 2}rem` }}
        />
        <span
          aria-hidden
          className="absolute left-[5px] w-px bg-foreground transition-[height] duration-300 ease-out motion-reduce:transition-none"
          style={{ top: `${ROW / 2}rem`, height: `${active * ROW}rem` }}
        />
        {SECTIONS.map((section, index) => {
          const state =
            index < active ? "done" : index === active ? "current" : "next"
          return (
            <li
              key={section.id}
              className="relative"
              style={{ height: `${ROW}rem` }}
            >
              <a
                href={`#${section.id}`}
                aria-current={state === "current" ? "location" : undefined}
                className="group flex h-full items-center gap-3 text-sm"
              >
                <span
                  aria-hidden
                  className={cn(
                    "relative size-[11px] shrink-0 rounded-[3px] border transition-colors duration-300 motion-reduce:transition-none",
                    state === "current" && "border-primary bg-primary",
                    state === "done" && "border-foreground bg-foreground",
                    state === "next" && "border-border bg-background"
                  )}
                />
                <span
                  className={cn(
                    "transition-colors",
                    state === "current"
                      ? "font-medium text-foreground"
                      : "text-muted-foreground group-hover:text-foreground"
                  )}
                >
                  {section.label}
                </span>
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
