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
import type { ProgressEntry } from "@prisma/client"

interface ProgressChartProps {
  entries: ProgressEntry[]
  targetBpm?: number | null
}

export function ProgressChart({ entries, targetBpm }: ProgressChartProps) {
  if (entries.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">Log your first session to see a chart</p>
      </div>
    )
  }

  const data = entries.map((e) => ({
    date: format(new Date(e.date), "MMM d"),
    bpm: e.bpm,
    rawDate: e.date,
  }))

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
          className="fill-muted-foreground"
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 12 }}
          className="fill-muted-foreground"
          tickLine={false}
          axisLine={false}
          domain={["auto", "auto"]}
          label={{ value: "BPM", angle: -90, position: "insideLeft", fontSize: 11, fill: "var(--muted-foreground)" }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            fontSize: "13px",
          }}
          labelStyle={{ color: "var(--popover-foreground)" }}
          itemStyle={{ color: "var(--popover-foreground)" }}
          formatter={(value) => [`${value} BPM`, "Tempo"]}
        />
        {targetBpm && (
          <ReferenceLine
            y={targetBpm}
            stroke="var(--chart-2)"
            strokeDasharray="4 4"
            label={{ value: `Goal: ${targetBpm}`, position: "right", fontSize: 11, fill: "var(--chart-2)" }}
          />
        )}
        <Line
          type="monotone"
          dataKey="bpm"
          stroke="var(--chart-1)"
          strokeWidth={2}
          dot={{ fill: "var(--chart-1)", r: 4, strokeWidth: 0 }}
          activeDot={{ r: 6, strokeWidth: 0 }}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
