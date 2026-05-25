import { redis, CACHE_KEYS, CACHE_TTL } from "@/lib/redis"
import { logger } from "@/lib/logger"

type MemoryEntry<T> = { expiresAt: number; value: T }

const memoryCache = new Map<string, MemoryEntry<unknown>>()

function isRedisConfigured() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

function getMemory<T>(key: string): T | null {
  const entry = memoryCache.get(key)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    memoryCache.delete(key)
    return null
  }
  return entry.value as T
}

function setMemory<T>(key: string, ttl: number, value: T) {
  memoryCache.set(key, { expiresAt: Date.now() + ttl * 1000, value })
}

export async function getCached<T>(key: string, fetcher: () => Promise<T>, ttl: number): Promise<T> {
  if (!isRedisConfigured()) {
    const cached = getMemory<T>(key)
    if (cached !== null) return cached
    const data = await fetcher()
    setMemory(key, ttl, data)
    return data
  }
  try {
    const cached = await redis.get<T>(key)
    if (cached !== null) return cached
    const data = await fetcher()
    await redis.setex(key, ttl, data)
    return data
  } catch (err) {
    logger.warn({ err, key }, "Redis cache error — falling back to DB")
    return fetcher()
  }
}

export async function invalidate(...keys: string[]) {
  keys.forEach((key) => memoryCache.delete(key))
  if (!isRedisConfigured()) return
  try {
    await Promise.all(keys.map((k) => redis.del(k)))
  } catch (err) {
    logger.warn({ err, keys }, "Redis invalidation failed")
  }
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
