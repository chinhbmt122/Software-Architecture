# Novel Reading Platform — Project Context

## What this is
A Vietnamese novel reading web platform. Curated content only (no public submissions). Monetization via subscriptions + coin/chapter unlocks. Target market: Vietnam-first, translated web novels (CN/KR/JP → VI).

## Stack
- **Framework**: Next.js 16 (App Router, Server Components, API Routes as backend — no separate service)
- **Database**: PostgreSQL via Neon (serverless) + Drizzle ORM
- **Auth**: Better Auth (email/password + Google OAuth; Facebook + Zalo planned)
- **Cache**: Upstash Redis
- **Search**: Meilisearch Cloud
- **Payments**: MoMo (primary), VNPay (secondary)
- **Images**: Cloudinary
- **CDN**: Cloudflare
- **UI**: shadcn/ui (Nova preset, Radix primitives, Tailwind v4)

## Project structure
```
Software Architecture/        ← project root (pnpm + Next.js)
  docs/                       ← SRS.md, ERD.md, SAD.md
  src/                        ← Next.js source dir
    app/                      ← App Router pages + API routes
      (auth)/                 ← sign-in, sign-up pages
      api/auth/[...all]/      ← Better Auth handler
    db/schema/                ← Drizzle schema (24 tables, split by module)
    lib/
      db.ts                   ← Neon + Drizzle client
      auth.ts                 ← Better Auth server config
      auth-client.ts          ← Better Auth client (React)
      utils.ts                ← cn() helper
    middleware.ts             ← session check, protected route redirect
    modules/                  ← feature modules (to be built per phase)
  drizzle.config.ts
  package.json
  .env.local                  ← fill in before running
```

## Module boundaries
- Modules live in `src/modules/{content,reader,community,monetization,search,notifications,admin}`
- Modules do NOT import from each other directly — only through exported service functions
- All DB access goes through the module that owns the table
- `lib/` is shared infrastructure only (no business logic)

## DB schema overview
All 24 tables are defined in `src/db/schema/` split by domain:
- `auth.ts` — users, sessions, accounts, verifications (Better Auth)
- `content.ts` — novels, chapters, genres, tags, novel_genres, novel_tags
- `reader.ts` — reading_progress, bookmarks, library_entries, novel_follows, user_follows
- `community.ts` — comments, comment_votes, reviews, review_votes, reports
- `monetization.ts` — coin_packages, payments, coin_transactions, chapter_unlocks, subscriptions
- `operations.ts` — notifications, audit_logs

Key design decisions:
- `users.id` is `text` (Better Auth default, not UUID)
- All FK references to `users.id` must be `text`, not `uuid`
- `coin_balance` is a denormalized INTEGER on `users`; every change must also write to `coin_transactions`
- Coin/subscription status is NEVER cached — always read from DB

## Monetization model
- 100 coins = 10,000 VND
- 1 coin per VIP chapter unlock
- Premium subscription = unlimited VIP access without spending coins
- Payment: MoMo webhook → verify HMAC → DB transaction (coins + ledger atomically)

## Phases
- **Phase 0**: Scaffold + DB schema + auth ✓
- **Phase 1**: Content module (novels, chapters, curator CMS) + basic reading UI ✓ ← YOU ARE HERE
- **Phase 2**: Monetization (coins, MoMo payment, chapter unlock)
- **Phase 3**: Community (comments, reviews), search (Meilisearch), notifications
- **Phase 4**: Admin panel, analytics, recommendations

## Deployment
- Development: Vercel hobby (free) — do NOT accept real payments on hobby tier
- Production: Switch to Vercel Pro or Cloudflare Pages before going live
- Database: Neon free tier (0.5GB, 100 compute-hrs) → Neon Launch ($19/mo) when needed

## Before running locally
1. Fill in `.env.local` (DATABASE_URL from neon.tech, BETTER_AUTH_SECRET, Google OAuth keys)
2. Run `pnpm db:push` to push schema to Neon
3. Run `pnpm dev`

## Useful commands
```bash
pnpm dev              # start dev server
pnpm db:push          # push schema changes to DB (add to package.json scripts)
pnpm db:studio        # open Drizzle Studio
pnpm build            # production build
```
