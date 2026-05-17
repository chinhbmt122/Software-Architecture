import { Redis } from "@upstash/redis"

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export const CACHE_TTL = {
  CHAPTER: 60 * 60 * 24,
  NOVEL: 60 * 60,
  TRENDING: 60 * 60,
  PROGRESS: 60 * 15,
} as const

export const CACHE_KEYS = {
  chapter: (id: string) => `chapter:${id}`,
  novel: (slug: string) => `novel:${slug}`,
  trending: () => `trending:novels`,
  newArrivals: () => `new:arrivals`,
  featured: () => `featured:novels`,
} as const
