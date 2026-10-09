import { Controller } from "../../vendor/stimulus.js"

// An ASCII river with salmon leaping out of it, for the Fat Bear Bracket card.
//
// The scene is drawn in three stacked <pre> layers so each can take its own color: deep water,
// the surface, and the fish. It runs at about 6 frames a second on purpose, for a low-fidelity
// handheld-game feel. It pauses when scrolled away or the tab is hidden, and shows a still frame
// for reduced motion.

const WIDTH = 56
const HEIGHT = 12
const FRAME_MS = 170

// Small, medium and large salmon, facing left (upstream).
const SALMON = ["<><", "<')><", "<')))><"]

// Five fish on unequal, staggered cycles (in frames), so one to three are usually in the air.
const SCHOOL = [
  { period: 38, offset: 0, seed: 1 },
  { period: 47, offset: 15, seed: 2 },
  { period: 53, offset: 29, seed: 3 },
  { period: 61, offset: 8, seed: 4 },
  { period: 43, offset: 36, seed: 5 }
]

export default class extends Controller {
  static targets = ["deep", "surface", "fish"]

  connect() {
    this.frame = 26
    this.render()
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return

    this.onScreen = true
    this.visibility = new IntersectionObserver(([entry]) => { this.onScreen = entry.isIntersecting })
    this.visibility.observe(this.element)
    this.timer = setInterval(() => {
      if (!this.onScreen || document.hidden) return
      this.frame++
      this.render()
    }, FRAME_MS)
  }

  disconnect() {
    clearInterval(this.timer)
    this.visibility?.disconnect()
  }

  render() {
    const layers = { deep: blank(), surface: blank(), fish: blank() }
    drawRiver(this.frame, layers)
    this.deepTarget.textContent = toText(layers.deep)
    this.surfaceTarget.textContent = toText(layers.surface)
    this.fishTarget.textContent = toText(layers.fish)
  }
}

// An undulating surface with shaded depth below it, drifting downstream (to the right),
// and the school of salmon leaping out of it.
function drawRiver(frame, layers) {
  const surface = (x) => Math.round(6.5 + 1.6 * Math.sin(x * 0.2 - frame * 0.16) + 0.9 * Math.sin(x * 0.07 + frame * 0.08))
  const shade = ["=", ":", ":", ".", ".", "."]

  for (let x = 0; x < WIDTH; x++) {
    const top = surface(x)
    layers.surface[top][x] = "#"
    for (let y = top + 1; y < HEIGHT; y++) {
      const lighter = mod(x + y * 2 - frame, 5) === 0 ? 1 : 0 // a little dither that drifts with the current
      layers.deep[y][x] = shade[Math.min(shade.length - 1, y - top - 1 + lighter)]
    }
  }

  for (const fish of SCHOOL) leap(frame, layers, surface, fish)
}

// One salmon on a repeating cycle: out of sight, then an arc out of the water and back in.
// Each leap picks a size at random; bigger fish jump higher and farther and stay up longer.
function leap(frame, layers, surface, { period, offset, seed }) {
  const n = frame + offset
  const cycle = Math.floor(n / period)
  const t = mod(n, period)

  const size = Math.floor(hash(cycle * 13 + seed * 3) * 3)
  const glyph = SALMON[size]
  const middle = Math.floor(glyph.length / 2)
  const height = 2 + size
  const span = 5 + size * 3
  const flight = 8 + size * 3

  const start = Math.round(14 + hash(cycle * 7 + seed) * 34) // leaves room to travel left and for the longest glyph
  const end = start - span
  const splash = ["'.'", ". .", " . "]
  const position = (u) => {
    const x = Math.round(start - span * u)
    return { x, y: surface(x + middle) - Math.round(height * Math.sin(Math.PI * u)) }
  }

  if (t >= 1 && t <= 2) put(layers, "surface", start + middle - 1, surface(start + middle), splash[t - 1])
  if (t < flight) {
    const { x, y } = position(t / (flight - 1))
    put(layers, "fish", x, y, glyph)
  } else if (t < flight + 3) {
    put(layers, t === flight ? "fish" : "surface", end + middle - 1, surface(end + middle), splash[t - flight])
  }
}

// Writes text on one layer and clears those cells on the others, so the layers never overlap.
function put(layers, layer, x, y, text) {
  for (let i = 0; i < text.length; i++) {
    const column = x + i
    if (text[i] === " " || column < 0 || column >= WIDTH || y < 0 || y >= HEIGHT) continue
    layers.deep[y][column] = " "
    layers.surface[y][column] = " "
    layers.fish[y][column] = " "
    layers[layer][y][column] = text[i]
  }
}

function blank() {
  return Array.from({ length: HEIGHT }, () => new Array(WIDTH).fill(" "))
}

function toText(grid) {
  return grid.map((row) => row.join("")).join("\n")
}

function mod(a, n) {
  return ((a % n) + n) % n
}

// A repeatable pseudo-random number in [0, 1) for a given integer.
function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}
