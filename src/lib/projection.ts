export type RegressionModel = "linear" | "poly2" | "poly3"

export interface FitResult {
  model: RegressionModel
  rss: number
  predict: (x: number) => number
  projectedDays: number | null // days from origin; null = no valid projection
}

export interface ProjectionResult {
  origin: number  // ms timestamp of first entry
  lastDays: number  // normalised x of last data point
  fits: Record<RegressionModel, FitResult | null>
  best: RegressionModel
}

// Solve Ax = b via Gaussian elimination with partial pivoting
function solve(A: number[][], b: number[]): number[] | null {
  const n = A.length
  const M = A.map((row, i) => [...row, b[i]])

  for (let col = 0; col < n; col++) {
    let maxRow = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row
    }
    ;[M[col], M[maxRow]] = [M[maxRow], M[col]]
    if (Math.abs(M[col][col]) < 1e-10) return null

    for (let row = col + 1; row < n; row++) {
      const f = M[row][col] / M[col][col]
      for (let j = col; j <= n; j++) M[row][j] -= f * M[col][j]
    }
  }

  const x = new Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n]
    for (let j = i + 1; j < n; j++) x[i] -= M[i][j] * x[j]
    x[i] /= M[i][i]
  }
  return x
}

// Fit polynomial of given degree to (xs, ys); xs should be normalised to ~[0,1]
function fitPolynomial(
  xs: number[],
  ys: number[],
  degree: number,
): { predict: (x: number) => number; rss: number } | null {
  const d = degree + 1
  if (xs.length < d) return null

  const XtX = Array.from({ length: d }, () => new Array(d).fill(0))
  const Xty = new Array(d).fill(0)

  for (let i = 0; i < xs.length; i++) {
    const basis = Array.from({ length: d }, (_, j) => Math.pow(xs[i], j))
    for (let j = 0; j < d; j++) {
      Xty[j] += basis[j] * ys[i]
      for (let k = 0; k < d; k++) XtX[j][k] += basis[j] * basis[k]
    }
  }

  const coeffs = solve(XtX, Xty)
  if (!coeffs) return null

  const predict = (x: number) => coeffs.reduce((sum, c, i) => sum + c * Math.pow(x, i), 0)
  const rss = ys.reduce((sum, y, i) => sum + Math.pow(y - predict(xs[i]), 2), 0)

  return { predict, rss }
}

// Bisection search: find x in (x0, xMax) where f(x) = target, f must be increasing
function bisect(f: (x: number) => number, target: number, x0: number, xMax: number): number | null {
  if (f(x0) >= target) return null
  if (f(xMax) < target) return null
  let lo = x0, hi = xMax
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (f(mid) < target) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

const MS_PER_DAY = 86_400_000
const MAX_PROJECTION_DAYS = 365 * 5

export function computeProjections(
  entries: { date: Date; bpm: number | null }[],
  targetBpm: number,
): ProjectionResult | null {
  const valid = entries
    .filter((e): e is typeof e & { bpm: number } => e.bpm !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  if (valid.length < 3) return null

  const origin = valid[0].date.getTime()
  const scale = (valid[valid.length - 1].date.getTime() - origin) / MS_PER_DAY || 1
  const xs = valid.map(e => (e.date.getTime() - origin) / MS_PER_DAY / scale)
  const ys = valid.map(e => e.bpm)
  const lastX = xs[xs.length - 1]  // = 1.0 after normalisation

  const MODELS: RegressionModel[] = ["linear", "poly2", "poly3"]
  const DEGREES: Record<RegressionModel, number> = { linear: 1, poly2: 2, poly3: 3 }

  const fits: Record<RegressionModel, FitResult | null> = {
    linear: null,
    poly2: null,
    poly3: null,
  }

  for (const model of MODELS) {
    const fit = fitPolynomial(xs, ys, DEGREES[model])
    if (!fit) continue

    // Reject if not increasing at the last data point
    const eps = 0.001
    if (fit.predict(lastX + eps) <= fit.predict(lastX)) continue

    // Project: find when predict(x) = targetBpm
    const maxX = lastX + MAX_PROJECTION_DAYS / scale
    const projX = bisect(fit.predict, targetBpm, lastX, maxX)
    const projectedDays = projX !== null ? projX * scale : null

    fits[model] = { model, rss: fit.rss, predict: (x: number) => fit.predict(x / scale), projectedDays }
  }

  // Only consider models that produced a valid future projection
  const available = MODELS.filter(m => fits[m]?.projectedDays != null) as RegressionModel[]
  if (available.length === 0) return null

  // Prefer simpler model unless the more complex one reduces RSS by >1%
  const best = available.reduce((a, b) => {
    const ra = fits[a]!.rss, rb = fits[b]!.rss
    return rb < ra * 0.99 ? b : a
  })

  return { origin, lastDays: lastX * scale, fits, best }
}
