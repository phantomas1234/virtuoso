"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts"
import { format } from "date-fns"
type EntryLike = { date: Date; bpm: number | null; hand?: "LEFT" | "RIGHT" | null }

interface ProgressChartProps {
  entries: EntryLike[]
  targetBpm?: number | null
  splitHands?: boolean
}

const yDomain = (targetBpm?: number | null) =>
  ([dataMin, dataMax]: readonly [number, number]): [number, number] => [
    Math.floor(dataMin * 0.97),
    targetBpm ? Math.max(dataMax, targetBpm) + Math.round(targetBpm * 0.03) : Math.ceil(dataMax * 1.03),
  ]

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

export function ProgressChart({ entries, targetBpm, splitHands }: ProgressChartProps) {
  if (entries.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">Log your first session to see a chart</p>
      </div>
    )
  }

  if (splitHands) {
    // Merge left and right entries by date label
    const byDate = new Map<string, { date: string; left: number | null; right: number | null }>()
    const sorted = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    for (const e of sorted) {
      const label = format(new Date(e.date), "MMM d")
      const row = byDate.get(label) ?? { date: label, left: null, right: null }
      if (e.hand === "LEFT") row.left = e.bpm
      else if (e.hand === "RIGHT") row.right = e.bpm
      else { row.left = e.bpm; row.right = e.bpm }
      byDate.set(label, row)
    }
    const data = Array.from(byDate.values())

    return (
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 5, right: 80, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} className="fill-muted-foreground" tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" tickLine={false} axisLine={false}
            domain={yDomain(targetBpm)}
            label={{ value: "BPM", angle: -90, position: "insideLeft", fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <Tooltip {...tooltipStyle} formatter={(value, name) => [`${value} BPM`, name === "left" ? "Left hand" : "Right hand"]} />
          {targetBpm && (
            <ReferenceLine y={targetBpm} stroke="var(--chart-2)" strokeDasharray="4 4"
              label={{ value: `Goal: ${targetBpm}`, position: "right", fontSize: 11, fill: "var(--chart-2)" }}
            />
          )}
          <Line type="monotone" dataKey="left" name="left" stroke="var(--chart-1)" strokeWidth={2}
            dot={{ fill: "var(--chart-1)", r: 4, strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} connectNulls={false}
          />
          <Line type="monotone" dataKey="right" name="right" stroke="var(--chart-3)" strokeWidth={2}
            dot={{ fill: "var(--chart-3)", r: 4, strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  const data = [...entries]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((e) => ({ date: format(new Date(e.date), "MMM d"), bpm: e.bpm }))

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 5, right: 80, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} className="fill-muted-foreground" tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" tickLine={false} axisLine={false}
          domain={yDomain(targetBpm)}
          label={{ value: "BPM", angle: -90, position: "insideLeft", fontSize: 11, fill: "var(--muted-foreground)" }}
        />
        <Tooltip {...tooltipStyle} formatter={(value) => [`${value} BPM`, "Tempo"]} />
        {targetBpm && (
          <ReferenceLine y={targetBpm} stroke="var(--chart-2)" strokeDasharray="4 4"
            label={{ value: `Goal: ${targetBpm}`, position: "right", fontSize: 11, fill: "var(--chart-2)" }}
          />
        )}
        <Line type="monotone" dataKey="bpm" stroke="var(--chart-1)" strokeWidth={2}
          dot={{ fill: "var(--chart-1)", r: 4, strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
