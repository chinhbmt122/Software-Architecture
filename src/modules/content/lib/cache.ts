import { redis, CACHE_KEYS, CACHE_TTL } from "@/lib/redis"

export async function getCached<T>(key: string, fetcher: () => Promise<T>, ttl: number): Promise<T> {
  if (!process.env.UPSTASH_REDIS_REST_URL) return fetcher()
  try {
    const cached = await redis.get<T>(key)
    if (cached !== null) return cached
    const data = await fetcher()
    await redis.setex(key, ttl, data)
    return data
  } catch {
    return fetcher()
  }
}

export async function invalidate(...keys: string[]) {
  if (!process.env.UPSTASH_REDIS_REST_URL) return
  try {
    await Promise.all(keys.map((k) => redis.del(k)))
  } catch {}
}

export const cache = {
  getTrending: <T>(fetcher: () => Promise<T>) =>
    getCached(CACHE_KEYS.trending(), fetcher, CACHE_TTL.TRENDING),

  getNewArrivals: <T>(fetcher: () => Promise<T>) =>
    getCached(CACHE_KEYS.newArrivals(), fetcher, CACHE_TTL.TRENDING),

  getNovel: <T>(slug: string, fetcher: () => Promise<T>) =>
    getCached(CACHE_KEYS.novel(slug), fetcher, CACHE_TTL.NOVEL),

  getChapter: <T>(id: string, fetcher: () => Promise<T>) =>
    getCached(CACHE_KEYS.chapter(id), fetcher, CACHE_TTL.CHAPTER),

  invalidateNovel: (slug: string) => invalidate(CACHE_KEYS.novel(slug), CACHE_KEYS.trending(), CACHE_KEYS.newArrivals()),
  invalidateChapter: (id: string) => invalidate(CACHE_KEYS.chapter(id)),
}
