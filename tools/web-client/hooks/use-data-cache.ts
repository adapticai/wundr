"use client"

import { useState, useCallback, useRef } from 'react'
import { CacheEntry, TimeRange } from '@/types/data'

interface UseDataCacheOptions {
  maxSize?: number
  defaultTTL?: number
}

interface UseDataCacheReturn<T> {
  cache: {
    get: (key: string) => T | null
    set: (key: string, data: T, ttl?: number) => void
    delete: (key: string) => void
    clear: () => void
    has: (key: string) => boolean
    size: () => number
  }
  setCache: (key: string, data: T, ttl?: number) => void
  getCache: (key: string) => T | null
  clearCache: () => void
}

const DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes
const MAX_CACHE_SIZE = 50

export function useDataCache<T>(
  namespace: string,
  options: UseDataCacheOptions = {}
): UseDataCacheReturn<T> {
  const { maxSize = MAX_CACHE_SIZE, defaultTTL = DEFAULT_TTL } = options
  const cacheRef = useRef<Map<string, CacheEntry<T>>>(new Map())
  const [cacheSize, setCacheSize] = useState(0)

  const getFullKey = useCallback((key: string) => `${namespace}:${key}`, [namespace])

  const isExpired = useCallback((entry: CacheEntry<T>): boolean => {
    return Date.now() > entry.expires
  }, [])

  const evictExpired = useCallback(() => {
    const cache = cacheRef.current
    let removed = 0
    
    for (const [key, entry] of cache.entries()) {
      if (isExpired(entry)) {
        cache.delete(key)
        removed++
      }
    }
    
    if (removed > 0) {
      setCacheSize(cache.size)
    }
  }, [isExpired])

  const evictOldest = useCallback(() => {
    const cache = cacheRef.current
    if (cache.size === 0) return
    
    // Find and remove the oldest entry
    let oldestKey = ''
    let oldestTime = Infinity
    
    for (const [key, entry] of cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp
        oldestKey = key
      }
    }
    
    if (oldestKey) {
      cache.delete(oldestKey)
      setCacheSize(cache.size)
    }
  }, [])

  const get = useCallback((key: string): T | null => {
    const fullKey = getFullKey(key)
    const entry = cacheRef.current.get(fullKey)
    
    if (!entry) {
      return null
    }
    
    if (isExpired(entry)) {
      cacheRef.current.delete(fullKey)
      setCacheSize(cacheRef.current.size)
      return null
    }
    
    return entry.data
  }, [getFullKey, isExpired])

  const set = useCallback((key: string, data: T, ttl = defaultTTL) => {
    const fullKey = getFullKey(key)
    const cache = cacheRef.current
    
    // Evict expired entries first
    evictExpired()
    
    // If we're at capacity and adding a new key, evict oldest
    if (cache.size >= maxSize && !cache.has(fullKey)) {
      evictOldest()
    }
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expires: Date.now() + ttl
    }
    
    cache.set(fullKey, entry)
    setCacheSize(cache.size)
  }, [getFullKey, defaultTTL, maxSize, evictExpired, evictOldest])

  const deleteEntry = useCallback((key: string) => {
    const fullKey = getFullKey(key)
    const deleted = cacheRef.current.delete(fullKey)
    if (deleted) {
      setCacheSize(cacheRef.current.size)
    }
    return deleted
  }, [getFullKey])

  const clear = useCallback(() => {
    cacheRef.current.clear()
    setCacheSize(0)
  }, [])

  const has = useCallback((key: string): boolean => {
    const fullKey = getFullKey(key)
    const entry = cacheRef.current.get(fullKey)
    
    if (!entry) {
      return false
    }
    
    if (isExpired(entry)) {
      cacheRef.current.delete(fullKey)
      setCacheSize(cacheRef.current.size)
      return false
    }
    
    return true
  }, [getFullKey, isExpired])

  const size = useCallback((): number => {
    evictExpired()
    return cacheRef.current.size
  }, [evictExpired])

  const cache = {
    get,
    set,
    delete: deleteEntry,
    clear,
    has,
    size
  }

  return {
    cache,
    setCache: set,
    getCache: get,
    clearCache: clear
  }
}
