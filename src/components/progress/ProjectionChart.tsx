"use client"

import { useState, useMemo } from "react"
import { format } from "date-fns"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts"
import { TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { computeProjections, type RegressionModel } from "@/lib/projection"

type EntryLike = { date: Date; bpm: number | null; hand?: "LEFT" | "RIGHT" | null }

interface ProjectionChartProps {
  entries: EntryLike[]
  targetBpm?: number | null
  splitHands?: boolean
}

const MODEL_LABELS: Record<RegressionModel, string> = {
  linear: "Linear",
  poly2: "Poly 2",
  poly3: "Poly 3",
}

const MS_PER_DAY = 86_400_000

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    fontSize: "13px",
  },
  labelStyle: { color: "var(--popover-foreground)" },
  itemStyle: { color: "var(--popover-foreground)" },
}

const yDomain = (targetBpm?: number | null) =>
  ([dataMin, dataMax]: readonly [number, number]): [number, number] => [
    Math.floor(dataMin * 0.97),
    targetBpm ? Math.max(dataMax, targetBpm) + Math.round(targetBpm * 0.03) : Math.ceil(dataMax * 1.03),
  ]

function futureDateLabels(lastDate: Date, projectedDate: Date, n = 4): Date[] {
  const step = (projectedDate.getTime() - lastDate.getTime()) / (n + 1)
  return Array.from({ length: n }, (_, i) => new Date(lastDate.getTime() + step * (i + 1)))
}

export function ProjectionChart({ entries, targetBpm, splitHands }: ProjectionChartProps) {
  const [showProjection, setShowProjection] = useState(false)
  const [selectedModel, setSelectedModel] = useState<RegressionModel | null>(null)

  const sorted = useMemo(
    () => [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [entries],
  )

  const projMain = useMemo(
    () => targetBpm ? computeProjections(sorted.filter(e => !splitHands || e.hand == null || e.hand !== "RIGHT"), targetBpm) : null,
    [sorted, targetBpm, splitHands],
  )
  const projLeft = useMemo(
    () => (targetBpm && splitHands) ? computeProjections(sorted.filter(e => e.hand === "LEFT"), targetBpm) : null,
    [sorted, targetBpm, splitHands],
  )
  const projRight = useMemo(
    () => (targetBpm && splitHands) ? computeProjections(sorted.filter(e => e.hand === "RIGHT"), targetBpm) : null,
    [sorted, targetBpm, splitHands],
  )

  const proj = splitHands ? (projLeft ?? projRight) : projMain
  const activeModel = selectedModel ?? proj?.best ?? "linear"

  const toggleProjection = () => {
    setShowProjection(v => !v)
    if (showProjection) setSelectedModel(null)
  }

  const chartData = useMemo(() => {
    if (!splitHands) {
      const baseData = sorted.map(e => ({
        date: format(new Date(e.date), "MMM d"),
        bpm: e.bpm,
        proj: null as number | null,
      }))

      if (!showProjection || !projMain) return baseData

      const fit = projMain.fits[activeModel]
      if (!fit?.projectedDays) return baseData

      const { origin } = projMain
      baseData.forEach((_pt, idx) => {
        const days = (sorted[idx].date.getTime() - origin) / MS_PER_DAY
        baseData[idx].proj = Math.round(fit.predict(days))
      })

      const lastDate = sorted[sorted.length - 1].date
      const projectedDate = new Date(origin + fit.projectedDays * MS_PER_DAY)
      futureDateLabels(lastDate, projectedDate).forEach(d => {
        const days = (d.getTime() - origin) / MS_PER_DAY
        baseData.push({ date: format(d, "MMM d ''yy"), bpm: null, proj: Math.round(fit.predict(days)) })
      })
      baseData.push({ date: format(projectedDate, "MMM d ''yy"), bpm: null, proj: targetBpm ?? null })
      return baseData
    }

    // Split-hands: merge entries by date
    const byDate = new Map<string, { date: string; left: number | null; right: number | null; projLeft: number | null; projRight: number | null }>()
    for (const e of sorted) {
      const label = format(new Date(e.date), "MMM d")
      const row = byDate.get(label) ?? { date: label, left: null, right: null, projLeft: null, projRight: null }
      if (e.hand === "LEFT") row.left = e.bpm
      else if (e.hand === "RIGHT") row.right = e.bpm
      else { row.left = e.bpm; row.right = e.bpm }
      byDate.set(label, row)
    }
    const baseData = Array.from(byDate.values())

    if (!showProjection) return baseData

    const addHandTrend = (handProj: ReturnType<typeof computeProjections>, key: "projLeft" | "projRight") => {
      if (!handProj) return null
      const fit = handProj.fits[activeModel]
      if (!fit?.projectedDays) return null
      const { origin } = handProj
      baseData.forEach(row => {
        const entry = sorted.find(e => format(new Date(e.date), "MMM d") === row.date)
        if (entry) {
          const days = (new Date(entry.date).getTime() - origin) / MS_PER_DAY
          ;(row as Record<string, unknown>)[key] = Math.round(fit.predict(days))
        }
      })
      return { fit, origin }
    }

    const leftInfo = addHandTrend(projLeft, "projLeft")
    const rightInfo = addHandTrend(projRight, "projRight")

    const allFutureDates: { date: Date; key: "projLeft" | "projRight"; value: number }[] = []
    const lastDate = sorted[sorted.length - 1].date

    for (const [info, key] of [[leftInfo, "projLeft"], [rightInfo, "projRight"]] as const) {
      if (!info?.fit.projectedDays) continue
      const projDate = new Date(info.origin + info.fit.projectedDays * MS_PER_DAY)
      futureDateLabels(lastDate, projDate).forEach(d => {
        const days = (d.getTime() - info.origin) / MS_PER_DAY
        allFutureDates.push({ date: d, key, value: Math.round(info.fit.predict(days)) })
      })
      allFutureDates.push({ date: projDate, key, value: targetBpm ?? 0 })
    }

    const futureMerged = new Map<string, { date: string; left: null; right: null; projLeft: number | null; projRight: number | null }>()
    for (const { date, key, value } of allFutureDates) {
      const label = format(date, "MMM d ''yy")
      const row = futureMerged.get(label) ?? { date: label, left: null, right: null, projLeft: null, projRight: null }
      row[key] = value
      futureMerged.set(label, row)
    }
    baseData.push(...Array.from(futureMerged.values()).sort((a, b) => a.date.localeCompare(b.date)))
    return baseData
  }, [sorted, showProjection, projMain, projLeft, projRight, activeModel, splitHands, targetBpm])

  const projectedDateText = useMemo(() => {
    if (!showProjection || !proj) return null
    const days = splitHands
      ? [projLeft, projRight]
          .filter(Boolean)
          .map(p => p!.fits[activeModel]?.projectedDays)
          .filter((d): d is number => d != null)
          .reduce((a, b) => Math.max(a, b), 0)
      : proj.fits[activeModel]?.projectedDays ?? null
    if (!days) return null
    return format(new Date(proj.origin + days * MS_PER_DAY), "MMMM d, yyyy")
  }, [showProjection, proj, projLeft, projRight, activeModel, splitHands])

  const availableModels = proj
    ? (["linear", "poly2", "poly3"] as RegressionModel[]).filter(m => proj.fits[m]?.projectedDays != null)
    : []

  if (entries.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">Log your first session to see a chart</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {proj && (
            <Button
              variant={showProjection ? "default" : "outline"}
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={toggleProjection}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Projection
            </Button>
          )}
          {showProjection && availableModels.length > 1 && (
            <div className="flex gap-1">
              {availableModels.map(m => (
                <button
                  key={m}
                  onClick={() => setSelectedModel(m)}
                  className={`h-7 px-2 rounded text-xs border transition-colors ${
                    activeModel === m
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-foreground"
                  }`}
                >
                  {MODEL_LABELS[m]}
                  {m === proj?.best && activeModel !== m && (
                    <span className="ml-1 opacity-50">★</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        {showProjection && projectedDateText && (
          <p className="text-xs text-muted-foreground">
            Projected target: <span className="font-medium text-foreground">{projectedDateText}</span>
          </p>
        )}
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 5, right: 80, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} className="fill-muted-foreground" tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 12 }} className="fill-muted-foreground" tickLine={false} axisLine={false}
            domain={yDomain(targetBpm)}
            label={{ value: "BPM", angle: -90, position: "insideLeft", fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <Tooltip
            {...tooltipStyle}
            formatter={(value, name) => {
              const labels: Record<string, string> = {
                bpm: "Tempo", left: "Left hand", right: "Right hand",
                proj: "Trend", projLeft: "Left trend", projRight: "Right trend",
              }
              return [`${value} BPM`, labels[name as string] ?? name]
            }}
          />
          {targetBpm && (
            <ReferenceLine y={targetBpm} stroke="var(--chart-2)" strokeDasharray="4 4"
              label={{ value: `Goal: ${targetBpm}`, position: "right", fontSize: 11, fill: "var(--chart-2)" }}
            />
          )}

          {!splitHands && (
            <>
              <Line type="monotone" dataKey="bpm" stroke="var(--chart-1)" strokeWidth={2}
                dot={{ fill: "var(--chart-1)", r: 4, strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} connectNulls={false}
              />
              {showProjection && (
                <Line type="monotone" dataKey="proj" stroke="var(--chart-1)" strokeWidth={1.5}
                  strokeDasharray="5 3" dot={false} connectNulls
                />
              )}
            </>
          )}

          {splitHands && (
            <>
              <Line type="monotone" dataKey="left" name="left" stroke="var(--chart-1)" strokeWidth={2}
                dot={{ fill: "var(--chart-1)", r: 4, strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} connectNulls={false}
              />
              <Line type="monotone" dataKey="right" name="right" stroke="var(--chart-3)" strokeWidth={2}
                dot={{ fill: "var(--chart-3)", r: 4, strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} connectNulls={false}
              />
              {showProjection && (
                <>
                  <Line type="monotone" dataKey="projLeft" name="projLeft" stroke="var(--chart-1)" strokeWidth={1.5}
                    strokeDasharray="5 3" dot={false} connectNulls
                  />
                  <Line type="monotone" dataKey="projRight" name="projRight" stroke="var(--chart-3)" strokeWidth={1.5}
                    strokeDasharray="5 3" dot={false} connectNulls
                  />
                </>
              )}
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
