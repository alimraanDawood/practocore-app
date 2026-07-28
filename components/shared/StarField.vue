<script setup lang="ts">
/**
 * Stippled star field that morphs between shapes.
 *
 * Every cell carries a weight. Weight drives size, shape (dot to diamond to
 * star) and colour (foreground to brand primary) together, so a mark growing
 * into a glyph morphs continuously without anything being tweened by hand.
 *
 * Shapes come from a rasteriser: anything drawable to a canvas is sampled once
 * per cell into a coverage map, which becomes the target weights. Text, SVG
 * paths and images all go through the same path.
 *
 * Rendered on canvas rather than DOM. At this density, per-node style recalc
 * would dominate every frame; here style is purely a function of weight, so
 * marks bucket by weight and the whole field draws in a fixed number of fill
 * calls no matter how many marks there are.
 */

/** A drawable shape source. */
export type StarFieldSource =
  | { kind: 'text'; value: string; font?: string }
  | { kind: 'path'; d: string; size: number; stroke?: number }
  /**
   * Any format the browser decodes, including WebP and PNG. Works with either
   * a transparent background or a flat light one: ink is taken as darkness
   * weighted by alpha, so both resolve the same way.
   *
   * Set `silhouette` for flat colour illustrations. Darkness alone punches
   * holes in them wherever the artwork is pale — a white belly or a yellow
   * crest reads as background. Silhouette mode instead floods the background
   * inward from the edges and treats everything it cannot reach as ink, with
   * darkness only modulating tone within the shape. Leave it off for line art
   * and engravings, where enclosed white areas are meant to stay empty.
   */
  | { kind: 'image'; src: string; silhouette?: boolean }

interface Props {
  /** Shapes to cycle through. One entry holds it static. */
  sequence?: StarFieldSource[]
  /** Target spacing between cell centres, in px. Grows to respect MAX_MARKS. */
  cell?: number
  /** Share of ambient marks tinted with the brand primary, 0 to 1. */
  accentRatio?: number
  /** Seconds a shape is held before the next transition. */
  hold?: number
  /** Seconds a transition takes, excluding per-mark stagger. */
  morph?: number
  /**
   * Height of the content block at the bottom, in px. The field fades out
   * above it. Anchored to the bottom edge rather than a percentage, because
   * the copy block is a fixed height while the viewport is not.
   * Omit to use the responsive default.
   */
  clearBottom?: number
}

const props = withDefaults(defineProps<Props>(), {
  sequence: () => [],
  cell: 7,
  accentRatio: 0.1,
  hold: 3.6,
  morph: 1.7,
  clearBottom: undefined
})

/**
 * Mark budget. Past this the cell size grows rather than the count.
 *
 * Detailed artwork needs roughly 60 columns before its interior line work
 * survives the downsample; below that an engraving collapses to a silhouette.
 * That sets the floor for this number.
 */
const MAX_MARKS = 9000

/** Viewport width the base cell size is tuned for. Wider screens space out. */
const REFERENCE_WIDTH = 430

/** Fraction of a cell the lightest and heaviest marks occupy. */
const MIN_SCALE = 0.14
const MAX_SCALE = 0.74

/** Weight buckets. Each is one fill() per frame. */
const BUCKETS = 12

/**
 * Weight a barely-covered glyph cell starts at. Sits above the ambient
 * ceiling so the faintest part of a shape still separates from the field.
 */
const GLYPH_FLOOR = 0.5

/** How far ambient marks swell either side of their resting weight. */
const AMBIENT_SWELL = 0.13

/** Longest extra delay a mark can take before joining a transition. */
const MAX_STAGGER = 0.55

/* These mirror the mask stops in the stylesheet below. Keep them in sync. */
const HEADER_CLEARANCE = 88
const MASK_FADE = 130

const root = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)

/** Decoded artwork plus its ink bounds, keyed by src. */
interface CachedImage {
  el: HTMLImageElement
  /** Bounding box of actual ink, in source pixels. */
  sx: number
  sy: number
  sw: number
  sh: number
}

const imageCache = new Map<string, CachedImage>()
const imagesPending = new Set<string>()

/**
 * Finds the bounding box of an image's ink so exported padding does not eat
 * into the drawn size. Logo exports are routinely a third empty, which at this
 * grid pitch is the difference between a legible shape and a smudge.
 * Measured on a downscaled copy: the box only needs to be roughly right.
 */
function measureInk(img: HTMLImageElement): CachedImage {
  const full: CachedImage = { el: img, sx: 0, sy: 0, sw: img.width, sh: img.height }
  const probe = 240
  const scale = Math.min(1, probe / Math.max(img.width, img.height))
  const pw = Math.max(1, Math.round(img.width * scale))
  const ph = Math.max(1, Math.round(img.height * scale))

  const c = document.createElement('canvas')
  c.width = pw
  c.height = ph
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return full
  ctx.drawImage(img, 0, 0, pw, ph)

  let data: Uint8ClampedArray
  try {
    data = ctx.getImageData(0, 0, pw, ph).data
  } catch {
    // Tainted canvas: a cross-origin image without CORS headers.
    return full
  }

  let minX = pw
  let minY = ph
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      const i = (y * pw + x) * 4
      const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255
      if ((data[i + 3] / 255) * (1 - lum) <= 0.08) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (maxX < 0) return full

  const inv = 1 / scale
  return {
    el: img,
    sx: minX * inv,
    sy: minY * inv,
    sw: (maxX - minX + 1) * inv,
    sh: (maxY - minY + 1) * inv
  }
}

/**
 * Decodes any image sources, then rebuilds. Sources that are not yet decoded
 * rasterise to nothing, so the field simply shows ambient noise for that
 * phase until the artwork lands.
 */
function loadImages(onReady: () => void) {
  for (const source of props.sequence) {
    if (source.kind !== 'image') continue
    const { src } = source
    if (imageCache.has(src) || imagesPending.has(src)) continue
    imagesPending.add(src)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imagesPending.delete(src)
      imageCache.set(src, measureInk(img))
      onReady()
    }
    img.onerror = () => {
      imagesPending.delete(src)
      console.warn(`[StarField] could not load ${src}`)
    }
    img.src = src
  }
}

/** Resolve any CSS colour the browser can parse down to [r,g,b]. */
function resolveRgb(color: string): [number, number, number] {
  const c = document.createElement('canvas')
  c.width = c.height = 1
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return [0, 0, 0]
  ctx.fillStyle = '#000'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 1, 1)
  const d = ctx.getImageData(0, 0, 1, 1).data
  return [d[0], d[1], d[2]]
}

/**
 * Rewrites alpha so it marks the subject rather than the ink.
 *
 * Floods inward from the canvas edge across anything background-like, then
 * treats every pixel the flood could not reach as part of the subject. This is
 * what keeps pale interior regions — a white belly, a yellow crest — attached
 * to the shape instead of punched out of it. Darkness then only varies tone
 * within the subject, so modelling survives without deciding the outline.
 */
function fillSilhouette(data: Uint8ClampedArray, w: number, h: number) {
  const total = w * h
  const seen = new Uint8Array(total)
  const stack = new Int32Array(total)
  let top = 0

  const isBackground = (p: number) => {
    const i = p * 4
    if (data[i + 3] < 25) return true
    return data[i] > 227 && data[i + 1] > 227 && data[i + 2] > 227
  }

  const push = (p: number) => {
    if (seen[p] || !isBackground(p)) return
    seen[p] = 1
    stack[top++] = p
  }

  for (let x = 0; x < w; x++) {
    push(x)
    push((h - 1) * w + x)
  }
  for (let y = 0; y < h; y++) {
    push(y * w)
    push(y * w + w - 1)
  }

  while (top > 0) {
    const p = stack[--top]
    const x = p % w
    if (x > 0) push(p - 1)
    if (x < w - 1) push(p + 1)
    if (p >= w) push(p - w)
    if (p < total - w) push(p + w)
  }

  for (let p = 0; p < total; p++) {
    const i = p * 4
    if (seen[p]) {
      data[i + 3] = 0
      continue
    }
    const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255
    // Floor keeps pale areas present; darkness adds the modelling on top.
    data[i + 3] = 255 * (0.5 + 0.5 * (1 - lum))
  }
}

/**
 * Draws a source into the band the mask leaves opaque, then box-filters it
 * down to one coverage value per cell. A box filter rather than point
 * sampling: strokes are routinely narrower than a cell, and point sampling
 * drops most of the shape. Partial coverage at the edges is what makes the
 * result stipple rather than clip.
 */
function rasterise(
  source: StarFieldSource,
  w: number,
  h: number,
  cell: number,
  cols: number,
  rows: number,
  clearPx: number
): Float32Array {
  const out = new Float32Array(cols * rows)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return out

  const bandTop = HEADER_CLEARANCE
  const bandHeight = h - clearPx - MASK_FADE - bandTop
  if (bandHeight < 40) return out

  const cx = w / 2
  const cy = bandTop + bandHeight / 2
  ctx.fillStyle = '#fff'
  ctx.strokeStyle = '#fff'

  if (source.kind === 'image') {
    const img = imageCache.get(source.src)
    if (!img) return out
    // Fit the ink, not the export canvas.
    const scale = Math.min((w * 0.88) / img.sw, bandHeight / img.sh)
    const dw = img.sw * scale
    const dh = img.sh * scale
    ctx.drawImage(img.el, img.sx, img.sy, img.sw, img.sh, cx - dw / 2, cy - dh / 2, dw, dh)
  } else if (source.kind === 'text') {
    const font = source.font ?? '700 1px "IBM Plex Serif", Geist, serif'
    ctx.font = font
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // Measure at 1px and scale, so one measurement fits any box.
    const unit = ctx.measureText(source.value)
    const uw = unit.width || 1
    const uh = (unit.actualBoundingBoxAscent || 0.7) + (unit.actualBoundingBoxDescent || 0.2)
    const size = Math.min((w * 0.72) / uw, (bandHeight * 0.94) / uh)
    ctx.font = font.replace('1px', `${size}px`)
    ctx.fillText(source.value, cx, cy)
  } else {
    const scale = Math.min((w * 0.66) / source.size, (bandHeight * 0.92) / source.size)
    ctx.save()
    ctx.translate(cx - (source.size * scale) / 2, cy - (source.size * scale) / 2)
    ctx.scale(scale, scale)
    const path = new Path2D(source.d)
    if (source.stroke) {
      ctx.lineWidth = source.stroke
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.stroke(path)
    } else {
      ctx.fill(path)
    }
    ctx.restore()
  }

  const data = ctx.getImageData(0, 0, w, h).data

  // Text and paths are drawn white on nothing, so alpha alone is the signal.
  // Artwork carries its ink in darkness instead, and may sit on a flat light
  // background rather than a transparent one. Folding darkness into alpha up
  // front lets one sampling loop serve both.
  if (source.kind === 'image') {
    if (source.silhouette) fillSilhouette(data, w, h)
    else {
      for (let i = 0; i < data.length; i += 4) {
        const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255
        data[i + 3] = data[i + 3] * (1 - lum)
      }
    }
  }

  const step = Math.max(1, Math.round(cell / 5))

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const px = col * cell + cell / 2
      const py = row * cell + cell / 2
      const x0 = Math.max(0, Math.round(px - cell / 2))
      const x1 = Math.min(w - 1, Math.round(px + cell / 2))
      const y0 = Math.max(0, Math.round(py - cell / 2))
      const y1 = Math.min(h - 1, Math.round(py + cell / 2))
      let total = 0
      let count = 0
      for (let y = y0; y <= y1; y += step) {
        for (let x = x0; x <= x1; x += step) {
          total += data[(y * w + x) * 4 + 3]
          count++
        }
      }
      out[row * cols + col] = count ? total / count / 255 : 0
    }
  }
  return out
}

/* Field state, held in flat arrays so the draw loop allocates nothing. */
let cols = 0
let rows = 0
let cell = 0
let count = 0
let px = new Float32Array(0)
let py = new Float32Array(0)
let ambient = new Float32Array(0)
let stagger = new Float32Array(0)
let seed = new Float32Array(0)
let from = new Float32Array(0)
let target = new Float32Array(0)
let accent = new Uint8Array(0)

let coverages: Float32Array[] = []
let phase = 0
let phaseStart = 0
let transitioning = false
let raf = 0
let styles: string[] = []
let reduced = false

function buildStyles() {
  if (!root.value) return
  const cs = getComputedStyle(root.value)
  const fg = resolveRgb(cs.color)
  const primary = resolveRgb(cs.getPropertyValue('--primary').trim() || cs.color)
  const dark = document.documentElement.classList.contains('dark')
  const minA = dark ? 0.1 : 0.14
  const maxA = dark ? 0.95 : 1

  styles = []
  for (let i = 0; i < BUCKETS; i++) {
    const t = i / (BUCKETS - 1)
    // Colour and alpha both ride the weight axis, so a mark consolidating
    // into a glyph warms toward the primary as it grows.
    const mix = Math.min(1, Math.max(0, (t - 0.55) / 0.35))
    const r = Math.round(fg[0] + (primary[0] - fg[0]) * mix)
    const g = Math.round(fg[1] + (primary[1] - fg[1]) * mix)
    const b = Math.round(fg[2] + (primary[2] - fg[2]) * mix)
    const a = minA + (maxA - minA) * Math.pow(t, 0.7)
    styles.push(`rgba(${r},${g},${b},${a.toFixed(3)})`)
  }
}

function build() {
  const el = root.value
  const cv = canvas.value
  if (!el || !cv) return
  const w = Math.round(el.clientWidth)
  const h = Math.round(el.clientHeight)
  if (!w || !h) return

  // Hold the mark count roughly constant across breakpoints: a phone-density
  // grid stretched to a desktop viewport reads as wallpaper.
  cell = props.cell * Math.min(1.7, Math.max(1, w / REFERENCE_WIDTH))
  while (Math.ceil(w / cell) * Math.ceil(h / cell) > MAX_MARKS) cell += 0.5

  cols = Math.ceil(w / cell)
  rows = Math.ceil(h / cell)
  count = cols * rows

  px = new Float32Array(count)
  py = new Float32Array(count)
  ambient = new Float32Array(count)
  stagger = new Float32Array(count)
  seed = new Float32Array(count)
  from = new Float32Array(count)
  target = new Float32Array(count)
  accent = new Uint8Array(count)

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col
      px[i] = col * cell + cell / 2
      py[i] = row * cell + cell / 2
      // Squaring biases ambient weight low, so most of the field is fine
      // stipple and only a scattered few carry a full star.
      // Ceiling well below the glyph band, or shape marks do not stand out.
      ambient[i] = Math.random() ** 2 * 0.42
      stagger[i] = Math.random() * MAX_STAGGER
      seed[i] = Math.random() * Math.PI * 2
      accent[i] = Math.random() < props.accentRatio ? 1 : 0
      // Glyph space starts empty, so the first shape gathers out of noise.
      from[i] = 0
      target[i] = 0
    }
  }

  const clearPx = parseFloat(getComputedStyle(el).getPropertyValue('--pc-star-clear')) || 300
  coverages = props.sequence.map((s) => rasterise(s, w, h, cell, cols, rows, clearPx))

  const dpr = Math.min(2, window.devicePixelRatio || 1)
  cv.width = Math.round(w * dpr)
  cv.height = Math.round(h * dpr)
  cv.style.width = `${w}px`
  cv.style.height = `${h}px`
  const ctx = cv.getContext('2d')
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  buildStyles()

  phase = 0
  phaseStart = performance.now() / 1000
  transitioning = true
  applyTargets(0)

  if (reduced) from.set(target)
  // Paint once synchronously. A starved rAF (background tab, throttled
  // webview) must not leave the field blank.
  drawStatic()
}

/**
 * Point every mark at the coverage map for `index`.
 *
 * Coverage drives weight across a wide range rather than snapping to a lit
 * level. Compressing it flattens artwork into a silhouette: a cell that is a
 * fifth covered and one that is fully covered end up the same size and colour,
 * so all interior modelling is lost. Line icons and text are near-binary and
 * are unaffected either way.
 *
 * Cells outside the shape get zero, not their ambient weight. Targets live in
 * glyph space only; ambient is a separate signal that never stops moving, and
 * the two are combined per frame.
 */
function applyTargets(index: number) {
  const cov = coverages[index]
  for (let i = 0; i < count; i++) {
    if (!cov) {
      target[i] = 0
      continue
    }
    const c = cov[i]
    target[i] = c > 0.1 ? GLYPH_FLOOR + Math.pow(c, 0.75) * (1 - GLYPH_FLOOR) : 0
  }
}

/** Ambient weight for mark `i` at time `t`, always in motion. */
function ambientAt(i: number, t: number) {
  return Math.max(0, ambient[i] + Math.sin(t * 1.5 + seed[i]) * AMBIENT_SWELL)
}

/**
 * Traces one mark. Shape rides the weight axis, and the ordering is driven by
 * ink rather than by hierarchy: a four-point star with this concavity covers
 * roughly a quarter of the circle that bounds it, so leaving it at the top of
 * the ramp made the glyph read faint exactly where it should be densest.
 *
 * Speck to star for the ambient field, then diamond to disc for glyph mass.
 */
function tracePath(ctx: Path2D, x: number, y: number, r: number, w: number) {
  // Ambient specks.
  if (w < 0.3) {
    ctx.moveTo(x + r, y)
    ctx.arc(x, y, r, 0, Math.PI * 2)
    return
  }

  // Ambient texture: the brand mark, scattered through the field.
  if (w < 0.62) {
    const inner = r * 0.26
    const d = inner * Math.SQRT1_2
    ctx.moveTo(x, y - r)
    ctx.lineTo(x + d, y - d)
    ctx.lineTo(x + r, y)
    ctx.lineTo(x + d, y + d)
    ctx.lineTo(x, y + r)
    ctx.lineTo(x - d, y + d)
    ctx.lineTo(x - r, y)
    ctx.lineTo(x - d, y - d)
    ctx.closePath()
    return
  }

  // Glyph mass. A disc here reads as a solid blob and loses the stipple; the
  // diamond still carries roughly three times the star's ink without it.
  // Core and edge stay distinguishable because size rides the same axis.
  ctx.moveTo(x, y - r)
  ctx.lineTo(x + r, y)
  ctx.lineTo(x, y + r)
  ctx.lineTo(x - r, y)
  ctx.closePath()
}

function paint(weights: Float32Array) {
  const cv = canvas.value
  const ctx = cv?.getContext('2d')
  if (!cv || !ctx) return
  ctx.clearRect(0, 0, cv.width, cv.height)

  // One path per weight bucket, so the whole field costs BUCKETS fills
  // regardless of how many marks it holds. Marks are visited exactly once and
  // traced straight into their bucket's path: bucketing inside the bucket loop
  // instead would scan the field BUCKETS times over.
  const paths: Path2D[] = []
  const used: boolean[] = []
  for (let b = 0; b < BUCKETS; b++) {
    paths.push(new Path2D())
    used.push(false)
  }

  for (let i = 0; i < count; i++) {
    const w = weights[i]
    if (w <= 0.02) continue
    const b = w >= 1 ? BUCKETS - 1 : (w * BUCKETS) | 0
    const size = cell * (MIN_SCALE + w * (MAX_SCALE - MIN_SCALE))
    tracePath(paths[b], px[i], py[i], size / 2, w)
    used[b] = true
  }

  for (let b = 0; b < BUCKETS; b++) {
    if (!used[b]) continue
    ctx.fillStyle = styles[b]
    ctx.fill(paths[b])
  }
}

const current = { value: new Float32Array(0) }

function drawStatic() {
  if (current.value.length !== count) current.value = new Float32Array(count)
  const t = performance.now() / 1000
  for (let i = 0; i < count; i++) current.value[i] = Math.max(ambientAt(i, t), from[i])
  paint(current.value)
}

function advance(t: number) {
  if (!count) return
  const elapsed = t - phaseStart

  if (current.value.length !== count) current.value = new Float32Array(count)
  const w = current.value

  // Ambient and glyph are independent signals combined per frame. Folding
  // them into one interpolated value stalls the background for the whole
  // transition, because a mark outside the shape then eases between two equal
  // numbers and holds still until the next phase.
  if (transitioning) {
    let done = true
    for (let i = 0; i < count; i++) {
      const p = Math.min(1, Math.max(0, (elapsed - stagger[i]) / props.morph))
      if (p < 1) done = false
      // Ease out quart: marks arrive decisively and settle without bounce.
      const e = 1 - Math.pow(1 - p, 4)
      w[i] = Math.max(ambientAt(i, t), from[i] + (target[i] - from[i]) * e)
    }
    if (done) {
      transitioning = false
      phaseStart = t
      from.set(target)
    }
  } else {
    for (let i = 0; i < count; i++) {
      w[i] = Math.max(ambientAt(i, t), target[i])
    }
    if (coverages.length > 1 && elapsed >= props.hold) {
      phase = (phase + 1) % coverages.length
      from.set(target)
      applyTargets(phase)
      transitioning = true
      phaseStart = t
    }
  }

  paint(w)
}

function frame(now: number) {
  raf = requestAnimationFrame(frame)
  advance(now / 1000)
}

let observer: ResizeObserver | null = null
let themeObserver: MutationObserver | null = null
let motionQuery: MediaQueryList | null = null
let lastW = 0
let lastH = 0

function start() {
  if (reduced || raf) return
  raf = requestAnimationFrame(frame)
}

function stop() {
  if (raf) cancelAnimationFrame(raf)
  raf = 0
}

function onVisibility() {
  if (document.hidden) stop()
  else start()
}

/**
 * Colours are baked into the bucket ramp at build time, so a theme switch has
 * to rebuild them. Repainting matters even while stopped: with reduced motion
 * or a hidden tab there is no frame coming to pick the change up.
 */
function onThemeChange() {
  buildStyles()
  if (!raf) paint(current.value.length === count ? current.value : from)
}

function onMotionChange(e: MediaQueryListEvent) {
  reduced = e.matches
  if (reduced) {
    stop()
    from.set(target)
    drawStatic()
  } else {
    phaseStart = performance.now() / 1000
    start()
  }
}

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  reduced = motionQuery.matches

  if (!root.value) return
  observer = new ResizeObserver(([entry]) => {
    const box = entry.contentRect
    // Rebuilding on sub-pixel scroll-bar jitter would reshuffle the field.
    if (Math.abs(box.width - lastW) < 8 && Math.abs(box.height - lastH) < 8) return
    lastW = box.width
    lastH = box.height
    build()
    start()
  })
  observer.observe(root.value)

  document.addEventListener('visibilitychange', onVisibility)
  motionQuery.addEventListener('change', onMotionChange)

  themeObserver = new MutationObserver(onThemeChange)
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  })

  if (import.meta.dev) {
    // Lets the animation be stepped deterministically for verification, since
    // rAF does not run in a hidden tab.
    ;(window as unknown as Record<string, unknown>).__pcStarField = {
      advance,
      freeze: stop,
      resume: start,
      goTo: (index: number) => {
        applyTargets(index)
        from.set(target)
        transitioning = false
        drawStatic()
      },
      restart: (t: number) => {
        phaseStart = t
      },
      get phase() {
        return phase
      },
      stats: () => ({
        marks: count,
        cols,
        rows,
        cell,
        shapes: coverages.length,
        // Cells each shape lights up. Zero means the raster missed the grid.
        hits: coverages.map((c) => c.reduce((n, v) => n + (v > 0.18 ? 1 : 0), 0)),
        transitioning,
        phase
      })
    }
  }
  // Rasterising before the webfont lands would stipple the fallback's shapes.
  document.fonts?.ready.then(() => {
    build()
    start()
  })

  loadImages(() => {
    build()
    start()
  })
})

onBeforeUnmount(() => {
  stop()
  observer?.disconnect()
  themeObserver?.disconnect()
  motionQuery?.removeEventListener('change', onMotionChange)
  document.removeEventListener('visibilitychange', onVisibility)
})

watch(
  () => [props.sequence, props.cell, props.accentRatio],
  () => {
    loadImages(() => {
      build()
      start()
    })
    build()
    start()
  },
  { deep: true }
)
</script>

<template>
  <div
    ref="root"
    class="pc-starfield text-foreground"
    :style="clearBottom ? { '--pc-star-clear': `${clearBottom}px` } : undefined"
    aria-hidden="true"
  >
    <canvas ref="canvas" class="pc-starfield-canvas" />
  </div>
</template>

<style>
.pc-starfield {
  --pc-star-clear: 250px;

  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  user-select: none;

  /* Clear the header bar, hold the upper field, fade out above the copy. */
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0,
    rgb(0 0 0 / 1) 88px,
    rgb(0 0 0 / 1) calc(100% - var(--pc-star-clear) - 130px),
    rgb(0 0 0 / 0.4) calc(100% - var(--pc-star-clear) - 55px),
    transparent calc(100% - var(--pc-star-clear))
  );
  mask-image: linear-gradient(
    to bottom,
    transparent 0,
    rgb(0 0 0 / 1) 88px,
    rgb(0 0 0 / 1) calc(100% - var(--pc-star-clear) - 130px),
    rgb(0 0 0 / 0.4) calc(100% - var(--pc-star-clear) - 55px),
    transparent calc(100% - var(--pc-star-clear))
  );

  animation: pc-starfield-in 900ms cubic-bezier(0.165, 0.84, 0.44, 1) 400ms both;
}

/* Wider gaps and taller bottom padding at md make the copy block taller. */
@media (min-width: 850px) {
  .pc-starfield {
    --pc-star-clear: 340px;
  }
}

.pc-starfield-canvas {
  display: block;
}

@keyframes pc-starfield-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pc-starfield {
    animation: none;
  }
}
</style>
