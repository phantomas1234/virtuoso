import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function bpmProgressColor(pct: number | null): { bar: string; text: string } {
  if (pct == null) return { bar: "bg-muted", text: "text-muted-foreground" }
  if (pct >= 100) return { bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" }
  if (pct >= 90)  return { bar: "bg-green-500",   text: "text-green-600 dark:text-green-400" }
  if (pct >= 75)  return { bar: "bg-blue-500",    text: "text-blue-600 dark:text-blue-400" }
  if (pct >= 50)  return { bar: "bg-amber-500",   text: "text-amber-600 dark:text-amber-400" }
  return               { bar: "bg-red-500",     text: "text-red-600 dark:text-red-400" }
}
