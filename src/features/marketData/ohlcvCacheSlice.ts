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
      
      // If we have too many entries, remove the least recently accessed ones
      const cacheKeys = Object.keys(state.cache);
      if (cacheKeys.length >= MAX_CACHE_ENTRIES) {
        const sortedKeys = cacheKeys
          .sort((a, b) => state.cache[a].lastAccessed - state.cache[b].lastAccessed)
          .slice(0, cacheKeys.length - MAX_CACHE_ENTRIES + 1);
        
        sortedKeys.forEach(key => delete state.cache[key]);
      }
      
      // Store a new copy of the data to ensure it's mutable
      state.cache[key] = {
        data: [...data],  // Create a new array with spread operator
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
