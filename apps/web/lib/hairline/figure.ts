import type { Vec2 } from "./core/iso"
import type { FigureMount, PointerHandlers, Readout } from "./core/stage"
import { inject } from "./core/styles"

/*
 * Hairline (github.com/lucasmarkes/hairline, MIT) ships nineteen figures and
 * no way to add one. Its engine lives in ./core, copied as it is upstream;
 * this is the package's mount.ts cut down to what the site's own figures need,
 * plus one thing the package does not do: a frame wider than 400 × 320.
 *
 * Taken from simoneergotino.it, where the engine was first vendored. The only
 * change to ./core is a few non-null assertions, because this site compiles
 * with noUncheckedIndexedAccess. LICENSE beside this file is upstream's.
 */

export type BrandFigure = {
  /** The default accessible name. */
  label: string
  /** The read-out at rest: empty, so nothing shows until the pointer picks something. */
  rest: string
  engine: FigureMount
  /** The engine's number at intensity 0, 0.5 and 1. */
  range: readonly [number, number, number]
  /** The viewBox. Hairline's own figures are 400 × 320. */
  size?: Vec2
}

export const DEFAULT_SIZE: Vec2 = [400, 320]
const NS = "http://www.w3.org/2000/svg"

/**
 * Hairline's pointer() for a frame of any size: core's version maps the
 * stage to 400 × 320 by hand. Same behaviour otherwise: a mouse leaving acts
 * at once, a finger lifting holds the pose for 1.4s.
 */
export function pointerIn(
  stage: HTMLElement,
  [w, h]: Vec2,
  on: PointerHandlers
): () => void {
  let timer = 0
  const at = (e: PointerEvent): Vec2 => {
    const r = stage.getBoundingClientRect()
    return [
      ((e.clientX - r.left) / r.width) * w,
      ((e.clientY - r.top) / r.height) * h,
    ]
  }
  const move = (e: PointerEvent) => {
    clearTimeout(timer)
    on.move(at(e), e)
  }
  const down = (e: PointerEvent) => {
    clearTimeout(timer)
    if (e.pointerType !== "mouse") stage.releasePointerCapture?.(e.pointerId)
    if (on.down) on.down(at(e), e)
    else on.move(at(e), e)
  }
  const leave = (e: PointerEvent) => {
    clearTimeout(timer)
    timer = window.setTimeout(
      () => on.leave(e),
      e.pointerType === "mouse" ? 0 : 1400
    )
  }
  stage.addEventListener("pointermove", move)
  stage.addEventListener("pointerdown", down)
  stage.addEventListener("pointerleave", leave)
  return () => {
    clearTimeout(timer)
    stage.removeEventListener("pointermove", move)
    stage.removeEventListener("pointerdown", down)
    stage.removeEventListener("pointerleave", leave)
  }
}

function valueAt(range: BrandFigure["range"], intensity: number) {
  const t = Math.min(1, Math.max(0, intensity))
  const [low, mid, high] = range
  return t <= 0.5
    ? low + (mid - low) * (t / 0.5)
    : mid + (high - mid) * ((t - 0.5) / 0.5)
}

export function mountFigure(
  figure: BrandFigure,
  el: HTMLElement,
  options: {
    intensity?: number
    label?: string
    onRead?: (text: string) => void
  } = {}
): () => void {
  const [w, h] = figure.size ?? DEFAULT_SIZE
  inject(el.ownerDocument)
  el.setAttribute("data-hairline", "")
  el.setAttribute("role", "img")
  el.setAttribute("aria-label", options.label ?? figure.label)
  // Hairline's stylesheet fixes the box at 5:4; a wider figure brings its own.
  el.style.aspectRatio = `${w} / ${h}`

  const svg = el.ownerDocument.createElementNS(NS, "svg")
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`)
  svg.setAttribute("aria-hidden", "true")
  el.appendChild(svg)

  let text: string | null = null
  const read: Readout = {
    get textContent() {
      return text
    },
    set textContent(value) {
      const next = value ?? ""
      if (next === text) return
      text = next
      options.onRead?.(next)
    },
  }

  const engine = figure.engine(
    { stage: el, svg, read },
    valueAt(figure.range, options.intensity ?? 0.5)
  )
  if (text === null) read.textContent = figure.rest

  return () => {
    engine.destroy()
    svg.remove()
    el.removeAttribute("data-hairline")
    el.style.removeProperty("aspect-ratio")
  }
}
