import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface OHLCVData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface CacheEntry {
  data: OHLCVData[];
  timestamp: number;
  expiryTime: number;
  lastAccessed: number;
}

interface OHLCVCache {
  [key: string]: CacheEntry;
}

interface OHLCVCacheState {
  cache: OHLCVCache;
}

const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const MAX_CACHE_ENTRIES = 50; // Maximum number of trades to cache

const initialState: OHLCVCacheState = {
  cache: {}
};

const ohlcvCacheSlice = createSlice({
  name: 'ohlcvCache',
  initialState,
  reducers: {
    cacheOHLCV: (state, action: PayloadAction<{
      key: string;
      data: OHLCVData[];
    }>) => {
      const { key, data } = action.payload;
      const now = Date.now();
      
      // First, clear expired entries
      Object.keys(state.cache).forEach(cacheKey => {
        if (state.cache[cacheKey].expiryTime < now) {
          delete state.cache[cacheKey];
        }
      });
      
      // If we're at max capacity, remove least recently used entry
      const cacheSize = Object.keys(state.cache).length;
      if (cacheSize >= MAX_CACHE_ENTRIES) {
        const oldestKey = Object.entries(state.cache)
          .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed)[0][0];
        delete state.cache[oldestKey];
        console.log('🗑️ Removed oldest cache entry:', oldestKey);
      }
      
      // Add new entry
      state.cache[key] = {
        data,
        timestamp: now,
        expiryTime: now + CACHE_EXPIRY,
        lastAccessed: now
      };
      
      console.log('📦 Cache status:', {
        entries: Object.keys(state.cache).length,
        maxEntries: MAX_CACHE_ENTRIES
      });
    },
    
    accessCache: (state, action: PayloadAction<string>) => {
      const key = action.payload;
      if (state.cache[key]) {
        state.cache[key].lastAccessed = Date.now();
      }
    },
    
    clearCache: (state) => {
      state.cache = {};
      console.log('🧹 Cache cleared');
    },
    
    clearExpiredCache: (state) => {
      const now = Date.now();
      let removedCount = 0;
      
      Object.keys(state.cache).forEach(key => {
        if (state.cache[key].expiryTime < now) {
          delete state.cache[key];
          removedCount++;
        }
      });
      
      if (removedCount > 0) {
        console.log(`🗑️ Removed ${removedCount} expired cache entries`);
      }
    }
  }
});

export const { cacheOHLCV, clearCache, clearExpiredCache, accessCache } = ohlcvCacheSlice.actions;
export default ohlcvCacheSlice.reducer;

// Helper to generate cache key
export const generateOHLCVCacheKey = (ticker: string, startTime: Date, endTime: Date): string => {
  // For ongoing trades (no exit time), use a fixed string instead of current time
  const endTimeKey = Math.abs(endTime.getTime() - new Date().getTime()) < 1000 ? 'ongoing' : endTime.getTime();
  const key = `${ticker}_${startTime.getTime()}_${endTimeKey}`;
  console.log('🔑 Generated cache key:', {
    ticker,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    endTimeKey,
    key
  });
  return key;
};

// Selector to get cached OHLCV data
export const selectCachedOHLCV = (state: any, key: string) => {
  const cached = state.ohlcvCache.cache[key];
  if (!cached || cached.expiryTime < Date.now()) {
    return null;
  }
  return cached.data;
};
