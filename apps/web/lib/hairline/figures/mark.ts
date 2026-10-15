import {
  Cam,
  fit,
  hull,
  open,
  poly,
  proj,
  rad,
  ringAt,
  run,
  type Projector,
  type Ring,
  type Sample,
  type Vec2,
  type Vec3,
} from "../core/iso"
import { tdone, tset, tval, tween, type Tween } from "../core/motion"
import {
  disposer,
  mk,
  put,
  register,
  solid,
  type FigureMount,
  type Solid,
} from "../core/stage"
import { pointerIn, type BrandFigure } from "../figure"

/*
 * Mark: mupx's logo standing on its edge, built as solids. The three bars are
 * slabs, one per account, plugged into an upright block, the gateway, that is
 * deeper than they are; the bar that leaves it on the right is the server
 * side and carries the one orange edge at rest. The pointer picks a slab: it
 * lifts a little, and its route across the block's face to the exit lights
 * up, the three routes joining as the requests do.
 *
 * Coordinates are the mark's own (apps/web/components/ui/mupx-mark.tsx, a
 * 256 box) with y turned into height, so the solids keep its proportions.
 * The face the logo is drawn on stays flush, so it reads as the mark at a
 * glance; only the block's depth says it is a gateway. Seen at 30°, not
 * Hairline's 45°: steeper, the bars slope enough to stop reading as the logo.
 */

const SIZE: Vec2 = [400, 320]
const AZ = 30
const R = 9
const TIGHT = 0.8
const BEVEL = 1.5
const SLAB_DEPTH = 16
const BLOCK_DEPTH = 30
const LIFT_MAX = 8
const TURN = 6
const SPINE: readonly [number, number] = [140, 176]
const EXIT_X = 224
const LEFT = 32
const MID = 128
const ACCOUNTS = ["work", "personal", "team"]
/** Each bar's bottom and top, as heights: the logo's y runs down, height runs up. */
const BARS: readonly (readonly [number, number])[] = [
  [176, 212],
  [110, 146],
  [44, 80],
]

/** A rounded rectangle in the mark's plane, each corner its own radius, in rrect's order. */
function rr(
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  radii: readonly [number, number, number, number],
  n = 4
): Ring {
  const out: Ring = []
  const corners: readonly (readonly [number, number, number, number])[] = [
    [u1, v1, -1, 0],
    [u0, v1, 1, 90],
    [u0, v0, 1, 180],
    [u1, v0, -1, 270],
  ]
  corners.forEach(([cu, cv, side, a0], i) => {
    const r = radii[i]!
    const ou = cu + side * r
    const ov = cv + (i < 2 ? -r : r)
    for (let k = 0; k <= n; k++) {
      const a = rad(a0 + (90 * k) / n)
      const ca = Math.cos(a)
      const sa = Math.sin(a)
      out.push({ u: ou + r * ca, v: ov + r * sa, nu: ca, nv: sa })
    }
  })
  return out
}

function inside(shape: readonly Vec2[], [x, y]: Vec2) {
  let c = false
  for (let i = 0, j = shape.length - 1; i < shape.length; j = i++) {
    const [xi, yi] = shape[i]!
    const [xj, yj] = shape[j]!
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

type Part = { el: Solid; outer: Ring; inner: Ring; depth: number }
type Zone = { hit: Vec2[]; caption: string; slab: number }

const engine: FigureMount = ({ stage, svg, read }, value) => {
  const bag = disposer()
  let lift = value
  const C = Cam(AZ, 0.5, 1)
  const corners = (
    [x0, x1]: readonly [number, number],
    depth: number,
    [z0, z1]: readonly [number, number]
  ): Vec3[] =>
    [x0, x1].flatMap((x) =>
      [-depth, 0].flatMap((y) => [z0, z1].map((z): Vec3 => [x, y, z]))
    )
  const extent: Vec3[] = [
    ...corners([LEFT, SPINE[0]], SLAB_DEPTH, [44, 212 + LIFT_MAX]),
    ...corners(SPINE, BLOCK_DEPTH, [44, 212]),
    ...corners([SPINE[1], EXIT_X], SLAB_DEPTH, [110, 146]),
  ]
  fit(C, extent, 0, 0)
  let P: Projector = proj(C)
  const box = extent.map((p) => P(...p))
  const span = (i: 0 | 1) =>
    Math.max(...box.map((p) => p[i])) - Math.min(...box.map((p) => p[i]))
  C.S = Math.min((SIZE[0] - 96) / span(0), (SIZE[1] - 40) / span(1))
  fit(C, extent, SIZE[0] / 2, SIZE[1] / 2)
  P = proj(C)
  // The logo's plane is x and height; its depth runs toward the viewer.
  const onFace: Projector = (u, v, d) => P(u, d, v)
  const s = Math.sin(C.az)
  const zf = Math.sqrt(1 - C.k * C.k)
  /** The face meets a side the camera sees: its top or its right, from here. */
  const seen = (q: Sample) => s * zf * q.nu + C.k * q.nv >= -1e-6

  function draw(part: Part, rise: number) {
    const up = (ring: Ring): Ring => ring.map((q) => ({ ...q, v: q.v + rise }))
    const outer = up(part.outer)
    put(part.el, {
      sil: poly(
        hull(
          ringAt(onFace, outer, -part.depth).concat(ringAt(onFace, outer, 0))
        )
      ),
      crease: open(ringAt(onFace, run(up(part.inner), seen), 0)),
    })
  }
  function shape(
    u0: number,
    v0: number,
    u1: number,
    v1: number,
    radii: readonly [number, number, number, number],
    depth: number,
    parent: Element
  ): Part {
    const inset = radii.map((r) => Math.max(0.3, r - BEVEL)) as [
      number,
      number,
      number,
      number,
    ]
    return {
      el: solid(parent),
      outer: rr(u0, v0, u1, v1, radii),
      inner: rr(u0 + BEVEL, v0 + BEVEL, u1 - BEVEL, v1 - BEVEL, inset),
      depth,
    }
  }

  const g = mk("g", {}, svg)
  const slabs = BARS.map(([v0, v1]) =>
    shape(LEFT, v0, SPINE[0], v1, [TIGHT, R, R, TIGHT], SLAB_DEPTH, g)
  )
  const block = shape(
    SPINE[0],
    44,
    SPINE[1],
    212,
    [R, TIGHT, TIGHT, R],
    BLOCK_DEPTH,
    g
  )
  const middle = (SPINE[0] + SPINE[1]) / 2
  const routes = BARS.map(([v0, v1]) => {
    const v = (v0 + v1) / 2
    const at = (u: number, h: number) => onFace(u, h, 0.01)
    const d =
      v === MID
        ? open([at(SPINE[0], v), at(SPINE[1], MID)])
        : (() => {
            const dir = Math.sign(MID - v)
            const [a, b, c, e] = [
              at(SPINE[0], v),
              at(middle - TURN, v),
              at(middle, v),
              at(middle, v + dir * TURN),
            ]
            const [f, h, i, j] = [
              at(middle, MID - dir * TURN),
              at(middle, MID),
              at(middle + TURN, MID),
              at(SPINE[1], MID),
            ]
            const pt = (p: Vec2) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`
            return `M${pt(a)}L${pt(b)}Q${pt(c)} ${pt(e)}L${pt(f)}Q${pt(h)} ${pt(i)}L${pt(j)}`
          })()
    return mk("path", { d, class: "nf lo" }, g)
  })
  const exit = shape(
    SPINE[1],
    110,
    EXIT_X,
    146,
    [R, TIGHT, TIGHT, R],
    SLAB_DEPTH,
    g
  )
  draw(block, 0)
  draw(exit, 0)
  exit.el.sil.classList.add("hi")

  const hullOf = (part: Part) =>
    hull(
      ringAt(onFace, part.outer, -part.depth).concat(
        ringAt(onFace, part.outer, 0)
      )
    )
  // A slab's hull reaches behind the block's face, so the block and the exit
  // are tested first; the visible part of a slab is outside both.
  const zones: Zone[] = [
    { hit: hullOf(block), caption: "gateway: token off, key on", slab: -1 },
    {
      hit: hullOf(exit),
      caption: "server: the same for every account",
      slab: -1,
    },
    ...slabs.map((part, k) => ({
      hit: hullOf(part),
      caption: `${ACCOUNTS[k]} → one server, its own key`,
      slab: k,
    })),
  ]

  const rises: Tween[] = slabs.map(() => tween(0))
  const drawn = slabs.map(() => Number.NaN)
  const loop = register(stage, (_dt, now) => {
    let moving = false
    slabs.forEach((part, k) => {
      const t = tval(rises[k]!, now)
      if (!tdone(rises[k]!, now)) moving = true
      const rise = t * lift
      if (rise === drawn[k]) return
      drawn[k] = rise
      draw(part, rise)
    })
    return moving
  })
  bag.add(() => loop.unregister())

  let active = -1
  function setActive(n: number) {
    if (n === active) return
    active = n
    const now = performance.now()
    slabs.forEach((part, k) => {
      tset(rises[k]!, k === n ? 1 : 0, now, 0)
      part.el.sil.classList.toggle("hi", k === n)
      routes[k]!.setAttribute("class", k === n ? "nf hi" : "nf lo")
    })
    loop.wake()
  }

  bag.add(
    pointerIn(stage, SIZE, {
      move: (p) => {
        const zone = zones.find((z) => inside(z.hit, p))
        setActive(zone?.slab ?? -1)
        read.textContent = zone?.caption ?? figure.rest
      },
      leave: () => {
        setActive(-1)
        read.textContent = figure.rest
      },
    })
  )
  bag.add(() => svg.replaceChildren())

  return {
    set: (next) => {
      lift = next
      drawn.fill(Number.NaN)
      loop.wake()
    },
    destroy: () => bag.dispose(),
  }
}

export const figure: BrandFigure = {
  label:
    "Drawing: the mupx mark as a solid. Three slabs, one per account, plug into one block, the gateway, and a single slab leaves it on the other side, toward the one MCP server.",
  rest: "",
  engine,
  range: [3, 5, LIFT_MAX],
  size: SIZE,
}
