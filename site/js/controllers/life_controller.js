import { Controller } from "../../vendor/stimulus.js"

// Conway's Game of Life as a slow, ambient background.
//
// - Each generation cross-fades into the next, so cells fade in and out instead of blinking.
// - Clicking or tapping drops an R-pentomino (five cells that keep evolving for 1,000+ generations).
// - A random soup burns out into still lifes within a minute or so, so whenever births fall below
//   0.2% of the field, a few R-pentominoes are dropped in at random. The field never settles.
// - It pauses when scrolled away or the tab is hidden, and shows a still frame for reduced motion.
export default class extends Controller {
  static targets = ["canvas"]
  static values = {
    cell: { type: Number, default: 7 },              // px per cell
    density: { type: Number, default: 0.14 },        // share of cells alive at the start
    speed: { type: Number, default: 3 },             // generations per second
    ground: { type: String, default: "#0e1013" },
    cellColor: { type: String, default: "#262a31" }, // settled cells
    accent: { type: String, default: "#8cb7e0" },    // newborn cells
    accentStrength: { type: Number, default: 0.8 },
    trail: { type: Number, default: 9 }              // generations to fade from accent to cellColor
  }

  connect() {
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches
    this.onScreen = true
    this.lastDraw = 0
    this.buildPalette()
    this.resize()

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(this.element)
    if (this.reduced) return

    this.visibility = new IntersectionObserver(([entry]) => { this.onScreen = entry.isIntersecting })
    this.visibility.observe(this.element)
    this.timer = setInterval(() => this.tick(), 1000 / this.speedValue)
    this.frame = requestAnimationFrame((now) => this.animate(now))
  }

  disconnect() {
    clearInterval(this.timer)
    cancelAnimationFrame(this.frame)
    this.resizeObserver?.disconnect()
    this.visibility?.disconnect()
  }

  seed(event) {
    const rect = this.canvasTarget.getBoundingClientRect()
    const x = Math.floor((event.clientX - rect.left) / this.cellValue)
    const y = Math.floor((event.clientY - rect.top) / this.cellValue)
    this.addPentomino(x, y)
    if (this.reduced) this.draw(1)
  }

  // --- simulation -----------------------------------------------------------------------------

  get running() {
    return this.onScreen && !document.hidden
  }

  resize() {
    const width = this.element.clientWidth
    const height = this.element.clientHeight
    if (!width || !height || (width === this.width && height === this.height)) return
    this.width = width
    this.height = height

    const ratio = window.devicePixelRatio || 1
    this.canvasTarget.width = Math.round(width * ratio)
    this.canvasTarget.height = Math.round(height * ratio)
    // Not `this.context`: Stimulus controllers already have a `context` property.
    this.canvasContext = this.canvasTarget.getContext("2d")
    this.canvasContext.setTransform(ratio, 0, 0, ratio, 0, 0)

    this.cols = Math.ceil(width / this.cellValue)
    this.rows = Math.ceil(height / this.cellValue)
    this.seedSoup()
    if (this.reduced) for (let i = 0; i < 60; i++) this.step()
    this.draw(1)
  }

  seedSoup() {
    const count = this.cols * this.rows
    this.cells = new Uint8Array(count)
    this.ages = new Uint16Array(count)
    for (let i = 0; i < count; i++) {
      if (Math.random() < this.densityValue) {
        this.cells[i] = 1
        this.ages[i] = 4 + Math.floor(Math.random() * 12) // start settled, not freshly born
      }
    }
    this.previous = this.cells.slice()
    this.generation = 0
    this.births = 0
    this.steppedAt = performance.now()
  }

  tick() {
    if (!this.running) return
    this.step()
    if (this.generation % 4 === 0 && this.births < this.cells.length * 0.002) {
      const count = Math.max(1, Math.round(this.cells.length / 6000))
      for (let i = 0; i < count; i++) {
        this.addPentomino(Math.floor(Math.random() * this.cols), Math.floor(Math.random() * this.rows))
      }
    }
  }

  // One generation, B3/S23, on a grid that wraps at the edges.
  step() {
    const { cols, rows, cells, ages } = this
    const next = new Uint8Array(cells.length)
    let births = 0

    for (let y = 0; y < rows; y++) {
      const up = ((y - 1 + rows) % rows) * cols
      const row = y * cols
      const down = ((y + 1) % rows) * cols
      for (let x = 0; x < cols; x++) {
        const left = (x - 1 + cols) % cols
        const right = (x + 1) % cols
        const neighbors =
          cells[up + left] + cells[up + x] + cells[up + right] +
          cells[row + left] + cells[row + right] +
          cells[down + left] + cells[down + x] + cells[down + right]
        const i = row + x
        const alive = neighbors === 3 || (neighbors === 2 && cells[i] === 1)

        if (alive) {
          next[i] = 1
          if (cells[i]) ages[i] = Math.min(ages[i] + 1, 999)
          else { ages[i] = 0; births++ }
        } else {
          ages[i] = 0
        }
      }
    }

    this.previous = cells
    this.cells = next
    this.births = births
    this.generation++
    this.steppedAt = performance.now()
  }

  addPentomino(x, y) {
    const shape = [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]]
    for (const [dx, dy] of shape) {
      const cx = x - 1 + dx
      const cy = y - 1 + dy
      if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) continue
      const i = cy * this.cols + cx
      this.cells[i] = 1
      this.ages[i] = 0
    }
  }

  // --- drawing --------------------------------------------------------------------------------

  animate(now) {
    this.frame = requestAnimationFrame((later) => this.animate(later))
    if (!this.running || now - this.lastDraw < 33) return // ~30 fps is plenty for a fade
    this.lastDraw = now
    this.draw(Math.min(1, (now - this.steppedAt) / (1000 / this.speedValue)))
  }

  // progress: 0 → 1 through the current generation. Born cells fade in, dying cells fade out.
  draw(progress) {
    const { canvasContext: context, cols, rows, cells, previous, ages, palette } = this
    const size = this.cellValue
    const gap = size >= 6 ? 1 : 0
    const eased = progress * progress * (3 - 2 * progress)
    const oldest = palette.length - 1

    context.globalAlpha = 1
    context.fillStyle = this.groundValue
    context.fillRect(0, 0, this.width, this.height)

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x
        const alive = cells[i]
        const was = previous[i]
        if (!alive && !was) continue

        const alpha = alive && was ? 1 : alive ? eased : 1 - eased
        if (alpha < 0.03) continue

        context.globalAlpha = alpha
        context.fillStyle = palette[alive ? Math.min(ages[i], oldest) : oldest]
        context.fillRect(x * size + gap, y * size + gap, size - gap * 2, size - gap * 2)
      }
    }
    context.globalAlpha = 1
  }

  // Colors from a newborn cell (accent, softened by accentStrength) to a settled one (cellColor).
  buildPalette() {
    const settled = hexToRgb(this.cellColorValue)
    const newborn = hexToRgb(this.accentValue).map((v, j) => settled[j] + (v - settled[j]) * this.accentStrengthValue)
    this.palette = []
    for (let i = 0; i <= this.trailValue; i++) {
      const t = i / this.trailValue
      const rgb = [0, 1, 2].map((j) => Math.round(newborn[j] + (settled[j] - newborn[j]) * t))
      this.palette.push(`rgb(${rgb.join(",")})`)
    }
  }
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
