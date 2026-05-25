"use client"

import { useReportWebVitals } from "next/web-vitals"

// Captures Core Web Vitals (LCP, FID, CLS, TTFB, INP) and logs them.
// Replace the fetch call with an analytics provider (Axiom, Plausible, etc.) when ready.
export function WebVitals() {
  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV === "development") {
      console.debug(`[web-vital] ${metric.name}: ${metric.value.toFixed(2)} (${metric.rating})`)
      return
    }
    // Production: send to /api/vitals endpoint so metrics land in server logs
    navigator.sendBeacon?.("/api/vitals", JSON.stringify(metric))
  })
  return null
}
