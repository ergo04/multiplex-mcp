"use client"

import { useEffect, useRef, useState, type PointerEvent } from "react"
import { DEFAULT_SIZE, mountFigure } from "@/lib/hairline/figure"
import { figure as gateway } from "@/lib/hairline/figures/gateway"
import { figure as mark } from "@/lib/hairline/figures/mark"
import { cn } from "@/lib/cn"

// Engines are functions, so a server component picks a figure by name.
const figures = { gateway, mark }

/**
 * A Hairline figure whose read-out is a caption beside the pointer: nothing
 * at rest, then a few words about what the pointer is over. Rendered on the
 * server as an empty box of the right ratio, so nothing shifts when the
 * drawing arrives.
 */
export function HairlineFigure({
  name,
  label,
  className,
}: {
  name: keyof typeof figures
  label?: string
  className?: string
}) {
  const figure = figures[name]
  const [w, h] = figure.size ?? DEFAULT_SIZE
  const ref = useRef<HTMLDivElement>(null)
  const [reading, setReading] = useState("")
  const [at, setAt] = useState({ x: 0, y: 0, flip: false, room: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    return mountFigure(figure, el, {
      label: label ?? figure.label,
      onRead: setReading,
    })
  }, [figure, label])

  const follow = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    // The caption takes the wider side of the pointer and wraps rather than leave
    // the column: on a phone a tap mid-figure has no room for one line.
    const flip = x > rect.width * 0.5
    const room = flip ? x - 12 : rect.width - x - 16
    setAt({ x, y: event.clientY - rect.top, flip, room })
  }

  return (
    <div
      className={cn("relative", className)}
      onPointerMove={follow}
      onPointerDown={follow}
    >
      <div
        ref={ref}
        role="img"
        aria-label={label ?? figure.label}
        className="w-full"
        style={{ aspectRatio: `${w} / ${h}` }}
      />
      <p
        aria-hidden="true"
        style={{
          maxWidth: at.room || undefined,
          transform: at.flip
            ? `translate(calc(${at.x - 12}px - 100%), ${at.y + 18}px)`
            : `translate(${at.x + 16}px, ${at.y + 18}px)`,
        }}
        className={cn(
          "pointer-events-none absolute top-0 left-0 w-max rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-balance text-foreground shadow-sm transition-opacity duration-200 motion-reduce:transition-none",
          reading ? "opacity-100" : "opacity-0"
        )}
      >
        {reading}
      </p>
    </div>
  )
}
