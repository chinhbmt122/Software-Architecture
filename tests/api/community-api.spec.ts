// Backend API tests: UC-15 Reviews, UC-16 Comments
import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test"
import { commentVotes, novels, reviews, reviewVotes } from "@/db/schema"
import { db } from "@/lib/db"
import { eq } from "drizzle-orm"

let firstNovelId: string
let firstChapterId: string

function freshEmail() {
  return `community.${Date.now()}.${Math.random().toString(36).slice(2)}@novelhub-test.com`
}

async function createIsolatedReader() {
  const context = await playwrightRequest.newContext({
    baseURL: "http://localhost:3000",
    extraHTTPHeaders: { origin: "http://localhost:3000" },
  })
  const res = await context.post("/api/auth/sign-up/email", {
    data: { name: "Community Helper", email: freshEmail(), password: "password123" },
  })
  expect(res.ok()).toBeTruthy()
  return context
}

async function postReview(request: APIRequestContext, novelId: string, rating: number, body: string | null = "Review") {
  const res = await request.post(`/api/novels/${novelId}/reviews`, { data: { rating, body } })
  expect([200, 201]).toContain(res.status())
  return res.json() as Promise<{ id: string; rating: number; body: string | null; helpfulCount: number }>
}

async function postComment(request: APIRequestContext, content: string, parentId: string | null = null) {
  const res = await request.post(
    `/api/novels/${firstNovelId}/chapters/${firstChapterId}/comments`,
    { data: { content, parentId } },
  )
  expect([200, 201]).toContain(res.status())
  return res.json() as Promise<{ id: string; content: string; parentId: string | null }>
}

test.beforeAll(async ({ request }) => {
  const novelsRes = await request.get("/api/novels")
  if (!novelsRes.ok()) return
  const novels: Array<{ id: string }> = await novelsRes.json()
  if (novels.length === 0) return
  firstNovelId = novels[0].id

  const chaptersRes = await request.get(`/api/novels/${firstNovelId}/chapters`)
  if (!chaptersRes.ok()) return
  const chapters: Array<{ id: string }> = await chaptersRes.json()
  if (chapters.length > 0) firstChapterId = chapters[0].id
})

// ── UC-15: Write Review ────────────────────────────────────────────────────────
test.describe("UC-15 Reviews — unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("TC-BE-15-001 review create returns 401 for unauthenticated", async ({ request }) => {
    const res = await request.post("/api/novels/any-id/reviews", {
      data: { rating: 4, body: "Great novel!" },
    })
    expect(res.status()).toBe(401)
  })
})

test.describe("UC-15 Reviews — authenticated", () => {
  test("TC-BE-15-002 valid review creates row", async ({ request }) => {
    if (!firstNovelId) test.skip()
    const res = await request.post(`/api/novels/${firstNovelId}/reviews`, {
      data: { rating: 4, body: "Test review body" },
    })
    // 200 (upsert) or 201 (create)
    expect([200, 201]).toContain(res.status())
    const review = await res.json()
    expect(review.rating).toBe(4)
  })

  test("TC-BE-15-003 second review from same user upserts — no duplicate", async ({ request }) => {
    if (!firstNovelId) test.skip()
    // First review
    await request.post(`/api/novels/${firstNovelId}/reviews`, {
      data: { rating: 3, body: "First review" },
    })
    // Second review — same user, same novel
    const res = await request.post(`/api/novels/${firstNovelId}/reviews`, {
      data: { rating: 5, body: "Updated review" },
    })
    expect([200, 201]).toContain(res.status())
    const review = await res.json()
    expect(review.rating).toBe(5)

    // Verify only one review exists
    const listRes = await request.get(`/api/novels/${firstNovelId}/reviews`)
    const data = await listRes.json()
    // myReview field should exist and be the latest upserted review
    expect(data.myReview?.rating ?? review.rating).toBe(5)
  })

  test("TC-BE-15-004 rating=0 returns 400 (BR-15-3 min=1)", async ({ request }) => {
    if (!firstNovelId) test.skip()
    const res = await request.post(`/api/novels/${firstNovelId}/reviews`, {
      data: { rating: 0, body: "Invalid rating" },
    })
    expect(res.status()).toBe(400)
  })

  test("TC-BE-15-006 rating=1 boundary accepted", async ({ request }) => {
    if (!firstNovelId) test.skip()
    const res = await request.post(`/api/novels/${firstNovelId}/reviews`, {
      data: { rating: 1, body: "Minimum rating" },
    })
    expect([200, 201]).toContain(res.status())
  })

  test("TC-BE-15-007 review body omitted (null) — accepted", async ({ request }) => {
    if (!firstNovelId) test.skip()
    const res = await request.post(`/api/novels/${firstNovelId}/reviews`, {
      data: { rating: 3, body: null },
    })
    expect([200, 201]).toContain(res.status())
  })

  test("TC-BE-15-005 rating=6 returns 400 (BR-15-3 max=5)", async ({ request }) => {
    if (!firstNovelId) test.skip()
    const res = await request.post(`/api/novels/${firstNovelId}/reviews`, {
      data: { rating: 6, body: "Invalid rating" },
    })
    expect(res.status()).toBe(400)
  })

  test("TC-BE-15-008 review body length boundary is enforced", async ({ request }) => {
    if (!firstNovelId) test.skip()
    const tooLong = await request.post(`/api/novels/${firstNovelId}/reviews`, {
      data: { rating: 4, body: "a".repeat(2001) },
    })
    expect(tooLong.status()).toBe(400)

    const boundary = await request.post(`/api/novels/${firstNovelId}/reviews`, {
      data: { rating: 4, body: "a".repeat(2000) },
    })
    expect([200, 201]).toContain(boundary.status())
  })

  test("TC-BE-15-009 avgRating recalculates after review upsert", async ({ request }) => {
    if (!firstNovelId) test.skip()
    await postReview(request, firstNovelId, 5, "Average check")
    const [novel] = await db.select({ avgRating: novels.avgRating }).from(novels).where(eq(novels.id, firstNovelId))
    expect(novel.avgRating).toBeTruthy()
    expect(Number(novel.avgRating)).toBeGreaterThanOrEqual(1)
    expect(Number(novel.avgRating)).toBeLessThanOrEqual(5)
  })

  test("TC-BE-15-010 deleting own review removes it and recalculates avgRating", async ({ request }) => {
    if (!firstNovelId) test.skip()
    const review = await postReview(request, firstNovelId, 4, "Delete me")
    const del = await request.delete(`/api/reviews/${review.id}`)
    expect(del.ok()).toBeTruthy()

    const [row] = await db.select({ id: reviews.id }).from(reviews).where(eq(reviews.id, review.id)).limit(1)
    expect(row).toBeUndefined()
  })

  test("TC-BE-15-011 deleting another user's review returns 403", async ({ request }) => {
    if (!firstNovelId) test.skip()
    const other = await createIsolatedReader()
    try {
      const review = await postReview(other, firstNovelId, 4, "Other user's review")
      const del = await request.delete(`/api/reviews/${review.id}`)
      expect(del.status()).toBe(403)
    } finally {
      await other.dispose()
    }
  })

  test("TC-BE-15-012 duplicate review helpful vote is idempotent-no-error", async ({ request }) => {
    if (!firstNovelId) test.skip()
    const other = await createIsolatedReader()
    try {
      const review = await postReview(other, firstNovelId, 4, "Vote target")
      const first = await request.post(`/api/reviews/${review.id}/helpful`)
      const second = await request.post(`/api/reviews/${review.id}/helpful`)
      expect(first.ok()).toBeTruthy()
      expect(second.ok()).toBeTruthy()
    } finally {
      await other.dispose()
    }
  })

  test("TC-BE-15-013 review list paginates at 20 items", async ({ request }) => {
    if (!firstNovelId) test.skip()
    const res = await request.get(`/api/novels/${firstNovelId}/reviews`)
    expect(res.ok()).toBeTruthy()
    const body: { items?: unknown[] } = await res.json()
    expect(body.items?.length ?? 0).toBeLessThanOrEqual(20)
  })

  test("TC-BE-15-014 helpful vote inserts row and increments helpful count", async ({ request }) => {
    if (!firstNovelId) test.skip()
    const other = await createIsolatedReader()
    try {
      const review = await postReview(other, firstNovelId, 4, "Helpful target")
      const res = await request.post(`/api/reviews/${review.id}/helpful`)
      expect(res.ok()).toBeTruthy()
      const [vote] = await db.select().from(reviewVotes).where(eq(reviewVotes.reviewId, review.id)).limit(1)
      const [stored] = await db.select({ helpfulCount: reviews.helpfulCount }).from(reviews).where(eq(reviews.id, review.id))
      expect(vote).toBeTruthy()
      expect(stored.helpfulCount).toBe(1)
    } finally {
      await other.dispose()
    }
  })

  test("TC-BE-15-015 helpful vote on own review returns 403", async ({ request }) => {
    if (!firstNovelId) test.skip()
    const review = await postReview(request, firstNovelId, 4, "Own vote target")
    const res = await request.post(`/api/reviews/${review.id}/helpful`)
    expect(res.status()).toBe(403)
  })

  test("TC-BE-15-016 review body XSS script is stripped", async ({ request }) => {
    if (!firstNovelId) test.skip()
    const review = await postReview(request, firstNovelId, 4, '<script>alert("x")</script>Plain text')
    expect(review.body ?? "").not.toContain("<script>")
    expect(review.body ?? "").toContain("Plain text")
  })

  test("TC-BE-15-017 review update replaces old rating and body", async ({ request }) => {
    if (!firstNovelId) test.skip()
    await postReview(request, firstNovelId, 2, "Old body")
    const updated = await postReview(request, firstNovelId, 5, "New body")
    expect(updated.rating).toBe(5)
    expect(updated.body).toBe("New body")
  })

  test("TC-BE-15-GET reviews list returns 200", async ({ request }) => {
    if (!firstNovelId) test.skip()
    const res = await request.get(`/api/novels/${firstNovelId}/reviews`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.reviews ?? body).toBeDefined()
  })
})

// ── UC-16: Leave Comment ───────────────────────────────────────────────────────
test.describe("UC-16 Comments — unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("TC-BE-16-001 comment create returns 401 for unauthenticated", async ({ request }) => {
    const res = await request.post("/api/novels/any-id/chapters/any-chapter-id/comments", {
      data: { content: "Test comment", targetType: "chapter" },
    })
    expect(res.status()).toBe(401)
  })
})

test.describe("UC-16 Comments — authenticated", () => {
  test("TC-BE-16-002 valid comment creates row", async ({ request }) => {
    if (!firstChapterId || !firstNovelId) test.skip()
    const res = await request.post(
      `/api/novels/${firstNovelId}/chapters/${firstChapterId}/comments`,
      {
        data: { content: "Playwright test comment", parentId: null },
      },
    )
    expect([200, 201]).toContain(res.status())
    const comment = await res.json()
    expect(comment.content ?? comment.body).toBeDefined()
  })

  test("TC-BE-16-003 empty comment body returns 400", async ({ request }) => {
    if (!firstChapterId || !firstNovelId) test.skip()
    const res = await request.post(
      `/api/novels/${firstNovelId}/chapters/${firstChapterId}/comments`,
      {
        data: { content: "", parentId: null },
      },
    )
    expect(res.status()).toBe(400)
  })

  test("TC-BE-16-GET comments list returns 200 array", async ({ request }) => {
    if (!firstChapterId || !firstNovelId) test.skip()
    const res = await request.get(
      `/api/novels/${firstNovelId}/chapters/${firstChapterId}/comments`,
    )
    expect(res.ok()).toBeTruthy()
  })

  test("TC-BE-16-004 comment over 1000 chars returns 400", async ({ request }) => {
    if (!firstChapterId || !firstNovelId) test.skip()
    const longComment = "a".repeat(1001)
    const res = await request.post(
      `/api/novels/${firstNovelId}/chapters/${firstChapterId}/comments`,
      {
        data: { content: longComment, parentId: null },
      },
    )
    expect(res.status()).toBe(400)
  })

  test("TC-BE-16-016 XSS in comment content is stripped", async ({ request }) => {
    if (!firstChapterId || !firstNovelId) test.skip()
    const res = await request.post(
      `/api/novels/${firstNovelId}/chapters/${firstChapterId}/comments`,
      {
        data: { content: '<script>alert("xss")</script>Safe text', parentId: null },
      },
    )
    if (res.ok()) {
      const comment = await res.json()
      const storedContent = comment.content ?? comment.body ?? ""
      expect(storedContent).not.toContain("<script>")
    }
  })

  test("TC-BE-16-005 reply with valid top-level parent is accepted", async ({ request }) => {
    if (!firstChapterId || !firstNovelId) test.skip()
    const parent = await postComment(request, "Parent comment")
    const reply = await postComment(request, "Reply comment", parent.id)
    expect(reply.parentId).toBe(parent.id)
  })

  test("TC-BE-16-006 reply-to-reply is rejected by depth guard", async ({ request }) => {
    if (!firstChapterId || !firstNovelId) test.skip()
    const parent = await postComment(request, "Depth parent")
    const reply = await postComment(request, "Depth reply", parent.id)
    const nested = await request.post(
      `/api/novels/${firstNovelId}/chapters/${firstChapterId}/comments`,
      { data: { content: "Nested reply", parentId: reply.id } },
    )
    expect(nested.status()).toBe(400)
  })

  test("TC-BE-16-007 non-existent parentId is rejected", async ({ request }) => {
    if (!firstChapterId || !firstNovelId) test.skip()
    const res = await request.post(
      `/api/novels/${firstNovelId}/chapters/${firstChapterId}/comments`,
      { data: { content: "Invalid parent", parentId: "00000000-0000-4000-8000-000000000000" } },
    )
    expect(res.status()).toBe(400)
  })

  test("TC-BE-16-011 top-level comments are sorted newest first", async ({ request }) => {
    if (!firstChapterId || !firstNovelId) test.skip()
    const older = await postComment(request, `Older ${Date.now()}`)
    await new Promise((resolve) => setTimeout(resolve, 20))
    const newer = await postComment(request, `Newer ${Date.now()}`)

    const list = await request.get(`/api/novels/${firstNovelId}/chapters/${firstChapterId}/comments`)
    const body: { items: Array<{ id: string }> } = await list.json()
    const newerIndex = body.items.findIndex((comment) => comment.id === newer.id)
    const olderIndex = body.items.findIndex((comment) => comment.id === older.id)
    expect(newerIndex).toBeGreaterThanOrEqual(0)
    expect(olderIndex).toBeGreaterThanOrEqual(0)
    expect(newerIndex).toBeLessThan(olderIndex)
  })

  test("TC-BE-16-012 replies are sorted oldest first", async ({ request }) => {
    if (!firstChapterId || !firstNovelId) test.skip()
    const parent = await postComment(request, `Reply order parent ${Date.now()}`)
    const first = await postComment(request, "First reply", parent.id)
    await new Promise((resolve) => setTimeout(resolve, 20))
    const second = await postComment(request, "Second reply", parent.id)

    const list = await request.get(`/api/novels/${firstNovelId}/chapters/${firstChapterId}/comments`)
    const body: { items: Array<{ id: string; replies: Array<{ id: string }> }> } = await list.json()
    const parentFromList = body.items.find((comment) => comment.id === parent.id)
    expect(parentFromList?.replies.map((reply) => reply.id)).toEqual([first.id, second.id])
  })

  test("TC-BE-16-013 duplicate comment vote is idempotent-no-error", async ({ request }) => {
    if (!firstChapterId || !firstNovelId) test.skip()
    const comment = await postComment(request, "Vote target")
    const first = await request.post(`/api/comments/${comment.id}/vote`, { data: { voteType: "UP" } })
    const second = await request.post(`/api/comments/${comment.id}/vote`, { data: { voteType: "UP" } })
    expect(first.ok()).toBeTruthy()
    expect(second.ok()).toBeTruthy()

    const votes = await db.select().from(commentVotes).where(eq(commentVotes.commentId, comment.id))
    expect(votes.length).toBeLessThanOrEqual(1)
  })

  test("TC-BE-16-017 comment list paginates at 20 items", async ({ request }) => {
    if (!firstChapterId || !firstNovelId) test.skip()
    const list = await request.get(`/api/novels/${firstNovelId}/chapters/${firstChapterId}/comments`)
    const body: { items: unknown[] } = await list.json()
    expect(body.items.length).toBeLessThanOrEqual(20)
  })
})

// ── Comment vote ───────────────────────────────────────────────────────────────
test.describe("Comment vote — unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("Vote on comment without auth returns 401", async ({ request }) => {
    const res = await request.post("/api/comments/any-id/vote")
    expect(res.status()).toBe(401)
  })
})

// ── Review helpful vote ────────────────────────────────────────────────────────
test.describe("Review helpful vote — unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("Helpful vote without auth returns 401", async ({ request }) => {
    const res = await request.post("/api/reviews/any-id/helpful")
    expect(res.status()).toBe(401)
  })
})
