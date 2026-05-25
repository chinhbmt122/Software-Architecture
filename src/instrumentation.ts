export async function register() {
  // Register OpenTelemetry — must run before any instrumented code
  const { registerOTel } = await import("@vercel/otel")
  registerOTel({ serviceName: "novelhub" })

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initSearchIndex } = await import("@/modules/search")
    await initSearchIndex()
  }
}
