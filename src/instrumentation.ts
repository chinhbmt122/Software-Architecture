export async function register() {
  // Log unhandled rejections so the actual crash reason appears in Vercel function logs
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.on("unhandledRejection", (reason) => {
      console.error("[unhandledRejection]", reason)
    })
  }

  // Register OpenTelemetry — must run before any instrumented code
  const { registerOTel } = await import("@vercel/otel")
  registerOTel({ serviceName: "novelhub" })

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initSearchIndex } = await import("@/modules/search")
    // Fire-and-forget — don't block startup; Meilisearch retry loop can take seconds
    initSearchIndex().catch((err) => console.warn("[search] init failed:", err))
  }
}
