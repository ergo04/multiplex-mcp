import {
  Cam,
  circ,
  clamp,
  facing,
  fillet,
  fit,
  hull,
  lerp,
  open,
  poly,
  prism,
  proj,
  rad,
  ringAt,
  rings,
  rrect,
  run,
  seg,
  type Ring,
  type Vec2,
  type Vec3,
} from "../core/iso"
import {
  reducedMotion,
  tdone,
  tset,
  tval,
  tween,
  type Tween,
} from "../core/motion"
import {
  disposer,
  flatDot,
  mk,
  place,
  put,
  register,
  solid,
  type FigureMount,
  type Solid,
} from "../core/stage"
import { pointerIn, type BrandFigure } from "../figure"

/*
 * Gateway: three letter trays, one per account of the same service, a rubber
 * stamp over its mat, and one larger tray for the service. The pointer picks
 * an account's tray: its top sheet goes under the stamp, which marks it with
 * that account's own key, and lands in the shared tray. Leaving sends it back
 * the same way, and the stamp takes the mark off as it passes, as the gateway
 * hands the response back without the upstream's challenge or cookies.
 *
 * The keys differ by their dots, never by a label. The trip is two discrete
 * moves, tray to stamp and stamp to tray, so it runs on two 700ms tweens; the
 * stamp's height is read off where the sheet is, so it never presses on air.
 */

const SIZE: Vec2 = [560, 240]
const SL = 30
const SW = 40
const SZ = 1
const SG = 1.4
const WT = 2
const TR = 4
const IN_WALL = 8
const OUT_WALL = 10
const MAT_T = 1.2
const ON_MAT = MAT_T + 0.3
const CRUISE_A = IN_WALL + 3
const CRUISE_B = OUT_WALL + 3
const PAD = 8.5
const MV = 27
const UP_MAX = 20
const COUNT = [4, 6, 3]
const OUT_COUNT = 7
const ACROSS = 92
const ROWS = [-70, 0, 70]
const ACCOUNTS = ["work", "personal", "team"]
const KEY_DOTS = [[0], [-2.1, 2.1], [-2.8, 0, 2.8]]
const JIT: readonly (readonly [number, number, number])[] = [
  [0.7, -0.6, 2],
  [-0.8, 0.5, -1.5],
  [0.4, 1, 2.5],
  [-0.5, -0.8, -2.5],
  [0.9, 0.3, 1],
  [-0.3, -1, -2],
]

/** Screen-right and toward the viewer, in world x/y: the trays read left to right. */
const onDesk = (across: number, toward: number): Vec2 => [
  (across + toward) / Math.SQRT2,
  (toward - across) / Math.SQRT2,
]
const smooth = (t: number) => {
  const c = clamp(t, 0, 1)
  return c * c * (3 - 2 * c)
}
const lr = (pts: Vec2[]) =>
  pts[0]![0] <= pts[pts.length - 1]![0] ? pts : [...pts].reverse()
const ring = (R: number, cu: number, cv: number, n = 20): Ring =>
  circ(R, n).map((q) => ({ u: q.u + cu, v: q.v + cv, nu: q.nu, nv: q.nv }))
const SHAPE = fillet(
  [
    [0, 0],
    [SL, 0],
    [SL, SW],
    [0, SW],
  ],
  [1.4, 1.4, 1.4, 1.4],
  3
)
const LINES: readonly Vec2[] = [
  [6, 0.75],
  [10, 0.9],
  [14, 0.6],
]
const MARK = ring(PAD - 1, SL / 2, MV)
const MARK_IN = ring(PAD - 3.4, SL / 2, MV)

function inside(shape: readonly Vec2[], [x, y]: Vec2) {
  let c = false
  for (let i = 0, j = shape.length - 1; i < shape.length; j = i++) {
    const [xi, yi] = shape[i]!
    const [xj, yj] = shape[j]!
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

type Warp = (u: number, v: number) => Vec2
type Sheet = {
  g: SVGGElement
  face: SVGPathElement
  lines: SVGPathElement
  mark: SVGPathElement
  dots: SVGEllipseElement[]
}
type Traveler = {
  sheet: Sheet
  home: Vec3
  turn: number
  a: Tween
  b: Tween
  marked: boolean
  slot: Element
  drawn: string
}
type Zone = { hit: Vec2[]; caption: string; tray: number }

const engine: FigureMount = ({ stage, svg, read }, value) => {
  const bag = disposer()
  let lift = value
  const C = Cam(45, 0.5, 1)
  const [mx, my] = onDesk(0, 0)
  const [ox, oy] = onDesk(ACROSS, 0)
  const homes = ROWS.map((row) => onDesk(-ACROSS, row))
  const sx = mx
  const sy = my + MV - SW / 2
  const outZ = SZ + OUT_COUNT * SG

  const corners = (cx: number, cy: number, hx: number, hy: number) =>
    [-1, 1].flatMap((i) => [-1, 1].map((j): Vec2 => [cx + i * hx, cy + j * hy]))
  const extent: Vec3[] = [
    ...homes.flatMap(([x, y]) =>
      corners(x, y, SL / 2 + 3 + WT, SW / 2 + 3 + WT).flatMap(
        ([u, v]): Vec3[] => [
          [u, v, 0],
          [u, v, CRUISE_A + 1],
        ]
      )
    ),
    ...corners(ox, oy, SL / 2 + 4 + WT, SW / 2 + 4 + WT).flatMap(
      ([u, v]): Vec3[] => [
        [u, v, 0],
        [u, v, CRUISE_B + 1],
      ]
    ),
    [sx, sy, MAT_T + UP_MAX + 26],
  ]
  fit(C, extent, 0, 0)
  let P = proj(C)
  const box = extent.map((p) => P(...p))
  const bw =
    Math.max(...box.map((p) => p[0])) - Math.min(...box.map((p) => p[0]))
  const bh =
    Math.max(...box.map((p) => p[1])) - Math.min(...box.map((p) => p[1]))
  C.S = Math.min((SIZE[0] - 24) / bw, (SIZE[1] - 24) / bh)
  fit(C, extent, SIZE[0] / 2, SIZE[1] / 2)
  P = proj(C)
  const front = facing(C)
  const g = mk("g", {}, svg)

  function tray(cx: number, cy: number, hx: number, hy: number, wall: number) {
    const outer = rrect(
      cx - hx - WT,
      cy - hy - WT,
      cx + hx + WT,
      cy + hy + WT,
      TR
    )
    const inner = rrect(cx - hx, cy - hy, cx + hx, cy + hy, TR - WT)
    const tg = mk("g", {}, g)
    const body = hull(ringAt(P, outer, 0).concat(ringAt(P, outer, wall)))
    mk("path", { d: poly(body), class: "sil" }, tg)
    const back = run(inner, (q) => !front(q))
    mk("path", { d: open(ringAt(P, back, wall)), class: "nf" }, tg)
    mk("path", { d: open(ringAt(P, back, 1)), class: "nf lo" }, tg)
    const slot = mk("g", {}, tg)
    const iF = lr(ringAt(P, run(inner, front), wall))
    const oT = lr(ringAt(P, run(outer, front), wall))
    const oB = lr(ringAt(P, run(outer, front), 0))
    const ends: Vec2[] = [oT[0]!, oT[oT.length - 1]!]
    mk(
      "path",
      {
        d: poly([...iF, ends[1]!, ...[...oB].reverse(), ends[0]!]),
        class: "fo",
      },
      tg
    )
    mk("path", { d: open(oT), class: "nf lo" }, tg)
    mk("path", { d: open(iF), class: "nf" }, tg)
    mk("path", { d: open([ends[0]!, ...oB, ends[1]!]), class: "nf sil" }, tg)
    return { slot, body }
  }

  function sheet(parent: Element, cls: string, keyDots: number): Sheet {
    const sg = mk("g", {}, parent)
    return {
      g: sg,
      face: mk("path", { class: cls }, sg),
      lines: mk("path", { class: "nf lo" }, sg),
      mark: mk("path", { class: "nf" }, sg),
      dots: (KEY_DOTS[keyDots] ?? []).map(() => flatDot(sg, C, 1.1, "dot m")),
    }
  }
  const flat =
    (cx: number, cy: number, deg: number, z: number): Warp =>
    (u, v) => {
      const c = Math.cos(rad(deg))
      const s = Math.sin(rad(deg))
      const a = u - SL / 2
      const b = v - SW / 2
      return P(cx + a * c - b * s, cy + a * s + b * c, z)
    }
  function drawSheet(el: Sheet, w: Warp, keyDots: number, marked: boolean) {
    el.face.setAttribute("d", poly(SHAPE.map(([u, v]) => w(u, v))))
    el.lines.setAttribute(
      "d",
      LINES.map(([v, f]) => seg(w(5, v), w(5 + (SL - 10) * f, v))).join("")
    )
    el.mark.setAttribute(
      "d",
      marked
        ? poly(MARK.map((q) => w(q.u, q.v))) +
            poly(MARK_IN.map((q) => w(q.u, q.v)))
        : ""
    )
    const offsets = KEY_DOTS[keyDots] ?? []
    el.dots.forEach((dot, i) => {
      place(dot, w(SL / 2 + (offsets[i] ?? 0), MV))
      dot.setAttribute("rx", marked ? String(1.1 * C.S) : "0")
      dot.setAttribute("ry", marked ? String(1.1 * C.S * C.k) : "0")
    })
  }

  const [matRing, matIn] = rings(
    mx - SL / 2 - 4,
    my - SW / 2 - 4,
    mx + SL / 2 + 4,
    my + SW / 2 + 4,
    3,
    1.2
  )
  put(solid(g), prism(P, front, matRing, matIn, 0, MAT_T))

  const zones: Zone[] = []
  const travelers: Traveler[] = homes.map(([hx, hy], k) => {
    const t = tray(hx, hy, SL / 2 + 3, SW / 2 + 3, IN_WALL)
    const count = COUNT[k] ?? 1
    for (let j = 0; j < count - 1; j++) {
      const [jx, jy, turn] = JIT[(j + k * 2) % JIT.length]!
      const el = sheet(t.slot, "", 0)
      drawSheet(el, flat(hx + jx, hy + jy, turn, SZ + j * SG), 0, false)
    }
    const [jx, jy, turn] = JIT[(count - 1 + k * 2) % JIT.length]!
    zones.push({
      hit: t.body,
      caption: `${ACCOUNTS[k]}: stamped with its own key`,
      tray: k,
    })
    return {
      sheet: sheet(t.slot, "sil", k),
      home: [hx + jx, hy + jy, SZ + (count - 1) * SG],
      turn,
      a: tween(0),
      b: tween(0),
      marked: false,
      slot: t.slot,
      drawn: "",
    }
  })
  const mid = mk("g", {}, g)

  const out = tray(ox, oy, SL / 2 + 4, SW / 2 + 4, OUT_WALL)
  for (let j = 0; j < OUT_COUNT; j++) {
    const [jx, jy, turn] = JIT[(j + 3) % JIT.length]!
    const top = j === OUT_COUNT - 1
    const el = sheet(out.slot, top ? "sil" : "", top ? 1 : 0)
    drawSheet(el, flat(ox + jx, oy + jy, turn, SZ + j * SG), 1, top)
  }
  const top = mk("g", {}, g)

  const sg = mk("g", {}, g)
  const parts: Solid[] = [solid(sg), solid(sg), solid(sg), solid(sg)]
  const block = rings(sx - 12, sy - 12, sx + 12, sy + 12, 5, 1.3)
  const pad = ring(PAD, sx, sy)
  const padIn = ring(PAD - 0.9, sx, sy)
  const neck = ring(3, sx, sy)
  const kFoot = ring(8, sx, sy)
  const kTop = ring(5.4, sx, sy)
  const kIn = ring(4.3, sx, sy)
  let stampZ = Number.NaN
  function drawStamp(z: number) {
    if (z === stampZ) return
    stampZ = z
    put(parts[0]!, prism(P, front, pad, padIn, z, z + 1.8))
    put(parts[1]!, prism(P, front, block[0], block[1], z + 1.8, z + 10))
    put(parts[2]!, {
      sil: poly(hull(ringAt(P, neck, z + 10).concat(ringAt(P, neck, z + 17)))),
      crease: "",
    })
    put(parts[3]!, {
      sil: poly(hull(ringAt(P, kFoot, z + 17).concat(ringAt(P, kTop, z + 25)))),
      crease: open(ringAt(P, run(kIn, front), z + 25)),
    })
  }
  const restZ = MAT_T + value
  zones.push({
    hit: hull(
      ringAt(P, matRing, 0).concat(
        ringAt(P, block[0], restZ + 1.8),
        ringAt(P, kTop, restZ + 25)
      )
    ),
    caption: "gateway: token off, key on",
    tray: -1,
  })
  zones.push({
    hit: out.body,
    caption: "server: the same for every account",
    tray: -1,
  })
  // Nearer trays overlap the ones behind, so they are tested first.
  const hitOrder = [
    ...zones.filter((z) => z.tray >= 0).reverse(),
    ...zones.filter((z) => z.tray < 0),
  ]

  // Plates hide what is behind them only when painted later: a sheet above a
  // wall is never behind it, a sheet below it is inside its tray.
  function pose(t: Traveler, a: number, b: number) {
    const [hx, hy, hz] = t.home
    const hA = smooth((a - 0.12) / 0.6)
    const hB = smooth((b - 0.08) / 0.62)
    const x = lerp(lerp(hx, mx, hA), ox, hB)
    const y = lerp(lerp(hy, my, hA), oy, hB)
    const turn = lerp(lerp(t.turn, 0, hA), -1.5, hB)
    let z =
      hz +
      (CRUISE_A - hz) * smooth(a / 0.2) -
      (CRUISE_A - ON_MAT) * smooth((a - 0.6) / 0.3)
    z +=
      (CRUISE_B - ON_MAT) * smooth((b - 0.08) / 0.25) -
      (CRUISE_B - outZ) * smooth((b - 0.65) / 0.35)
    const slot =
      b <= 0 && z < IN_WALL && hA < 0.1
        ? t.slot
        : b > 0 && z >= OUT_WALL
          ? top
          : b > 0 && hB > 0.9
            ? out.slot
            : mid
    return { w: flat(x, y, turn, z), slot }
  }
  const pressOf = (a: number, b: number) =>
    smooth((a - 0.93) / 0.07) * (1 - smooth(b / 0.1))

  let active = -1
  const loop = register(stage, (_dt, now) => {
    let moving = false
    let press = 0
    travelers.forEach((t, k) => {
      const a = tval(t.a, now)
      const b = tval(t.b, now)
      const p = pressOf(a, b)
      press = Math.max(press, p)
      if (p > 0.92 && t.marked !== (active === k)) {
        t.marked = active === k
        light()
      }
      if (!tdone(t.a, now) || !tdone(t.b, now)) moving = true
      const key = `${a}|${b}|${t.marked}`
      if (key === t.drawn) return
      t.drawn = key
      const at = pose(t, a, b)
      if (at.slot !== t.sheet.g.parentNode) at.slot.appendChild(t.sheet.g)
      drawSheet(t.sheet, at.w, k, t.marked)
    })
    drawStamp(lerp(MAT_T + lift, ON_MAT + 0.2, press))
    return moving
  })
  bag.add(() => loop.unregister())

  function light() {
    travelers.forEach((t, k) => {
      const on = active === k
      // Once stamped, the bright moves from the sheet to the key it now carries.
      t.sheet.face.setAttribute("class", on && !t.marked ? "hi" : "sil")
      t.sheet.mark.setAttribute("class", on ? "nf hi" : "nf")
      t.sheet.dots.forEach((d) => d.setAttribute("class", on ? "dot" : "dot m"))
    })
    parts[1]!.sil.classList.toggle("hi", active < 0)
  }

  function setActive(n: number) {
    if (n === active) return
    const now = performance.now()
    active = n
    let wait = 0
    travelers.forEach((t, k) => {
      if (k === n) return
      const bOut = tval(t.b, now) > 0.001
      tset(t.b, 0, now, 0)
      tset(t.a, 0, now, bOut ? 700 : 0)
      if (bOut) wait = Math.max(wait, t.b.t0 + t.b.dur - now + 150)
      else if (tval(t.a, now) > 0.001) wait = Math.max(wait, t.a.t0 - now + 150)
    })
    const t = travelers[n]
    if (t) {
      const there = tval(t.a, now) > 0.999
      tset(t.a, 1, now, wait)
      tset(t.b, 1, now, wait + (there ? 0 : 700))
    }
    if (reducedMotion()) travelers.forEach((s, k) => (s.marked = k === n))
    light()
    loop.wake()
  }

  const caption = (zone: Zone | undefined) =>
    zone?.caption ??
    (active >= 0 ? zones.find((z) => z.tray === active)?.caption : undefined) ??
    figure.rest
  light()
  bag.add(
    pointerIn(stage, SIZE, {
      move: (p) => {
        const zone = hitOrder.find((z) => inside(z.hit, p))
        if (zone && zone.tray >= 0) setActive(zone.tray)
        read.textContent = caption(zone)
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
      stampZ = Number.NaN
      loop.wake()
    },
    destroy: () => bag.dispose(),
  }
}

export const figure: BrandFigure = {
  label:
    "Drawing: three trays of sheets, one per account. Each sheet passes under one stamp that marks it with its account's own key, and every sheet lands in the same tray, the one MCP server.",
  rest: "",
  engine,
  range: [12, 16, UP_MAX],
  size: SIZE,
}
