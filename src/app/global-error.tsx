"use client"

import { useEffect } from "react"

// Catches errors thrown by RootLayout itself — must provide its own <html>/<body>
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[global-error]", { message: error.message, digest: error.digest })
  }, [error])

  return (
    <html lang="vi">
      <body
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          gap: "12px",
          fontFamily: "sans-serif",
          margin: 0,
          background: "#fff",
          color: "#1a1a1a",
        }}
      >
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>Ứng dụng gặp sự cố</h2>
        {error.digest && (
          <p style={{ fontSize: "0.75rem", color: "#888", fontFamily: "monospace", margin: 0 }}>
            ID: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{
            padding: "8px 20px",
            background: "#1a1a1a",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "0.875rem",
          }}
        >
          Tải lại
        </button>
      </body>
    </html>
  )
}
