import { supabase } from '../config/supabaseClient';

interface OHLCVData {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export const historicalDataService = {
    // Cache key format: ticker_startDate_endDate
    getCacheKey: (ticker: string, startDate: Date, endDate: Date) => {
        return `ohlcv_${ticker}_${startDate.toISOString()}_${endDate.toISOString()}`;
    },

    // Check if data is cached and still valid (24 hours)
    getCachedData: (cacheKey: string): OHLCVData[] | null => {
        console.log('🔍 Checking cache for key:', cacheKey);
        const cached = localStorage.getItem(cacheKey);
        if (!cached) {
            console.log('❌ No cached data found');
            return null;
        }

        const { timestamp, data } = JSON.parse(cached);
        const isValid = Date.now() - timestamp < 24 * 60 * 60 * 1000; // 24 hours
        console.log('📅 Cache age:', Math.round((Date.now() - timestamp) / (60 * 1000)), 'minutes');
        console.log('✅ Cache valid?', isValid);
        return isValid ? data : null;
    },

    // Cache the data
    cacheData: (cacheKey: string, data: OHLCVData[]) => {
        console.log('💾 Caching data for key:', cacheKey);
        const cacheData = {
            timestamp: Date.now(),
            data
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        console.log('✅ Data cached successfully');
    },

    // Fetch OHLCV data from Google Finance
    fetchOHLCVData: async (ticker: string, startDate: Date, endDate: Date): Promise<OHLCVData[]> => {
        console.log('📊 Fetching OHLCV data for:', ticker);
        console.log('📅 Date range:', startDate.toISOString(), 'to', endDate.toISOString());
        console.log('Start Date:', startDate);
        console.log('End Date:', endDate);
        
        const cacheKey = historicalDataService.getCacheKey(ticker, startDate, endDate);
        const cachedData = historicalDataService.getCachedData(cacheKey);
        
        if (cachedData) {
            console.log('🔄 Using cached data');
            return cachedData;
        }

        try {
            console.log('🌐 Fetching from market data service...');
            // Use local server during development
            const isDev = process.env.NODE_ENV === 'development';
            const url = isDev 
                ? 'http://localhost:3001/market-data'
                : 'https://yljkxkaensjkukzbklqq.supabase.co/functions/v1/fetch-market-data';

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ticker,
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString()
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const marketData = await response.json();
            console.log('✅ Received market data:', marketData?.length || 0, 'data points');
            
            // Cache the data
            historicalDataService.cacheData(cacheKey, marketData);
            return marketData;
        } catch (error) {
            console.error('❌ Error fetching OHLCV data:', error);
            throw error;
        }
    }
};
