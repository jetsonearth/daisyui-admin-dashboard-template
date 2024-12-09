class MarketDataService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 1800000; // 30 minutes cache
        this.sheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRzNnZcQG7SoBq22GFq_CBvACdqYDjSJM5EkSB0RGWwEZtN9LAlxY7ZvyjpOWi8DeeDTs5-U5bkXFM7/pub?gid=0&single=true&output=csv';
        this.priceMap = new Map();
        this.lastFetchTime = 0;
    }

    async fetchSheetData() {
        try {
            const now = Date.now();
            
            // Use cached data if within timeout
            if (this.priceMap.size > 0 && now - this.lastFetchTime < this.cacheTimeout) {
                console.log('🔵 Using cached sheet data');
                return this.priceMap;
            }

            console.log('🔄 Fetching fresh data from Google Sheet...');
            const response = await fetch(this.sheetUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const csvText = await response.text();
            
            // Clear existing map
            this.priceMap.clear();
            
            // Parse CSV and populate map - skip header
            const rows = csvText.split('\n').slice(1);
            
            // Process all rows in a single loop for better performance
            for (const row of rows) {
                const [ticker, priceStr] = row.split(',');
                if (ticker && priceStr) {
                    const price = parseFloat(priceStr);
                    if (!isNaN(price)) {
                        this.priceMap.set(ticker.trim(), price);
                    }
                }
            }

            this.lastFetchTime = now;
            console.log(`✅ Sheet data fetched: ${this.priceMap.size} tickers loaded`);
            return this.priceMap;
        } catch (error) {
            console.error('❌ Error fetching sheet data:', error);
            return new Map(); // Return empty map on error
        }
    }

    async getQuote(symbol) {
        try {
            const now = Date.now();
            const cached = this.cache.get(symbol);
            
            if (cached && (now - cached.timestamp) < this.cacheTimeout) {
                console.log('🔵 Using cached data for', symbol, cached.data);
                return cached.data;
            }

            console.log('🟡 Fetching new price for', symbol);
            
            const priceMap = await this.fetchSheetData();
            if (priceMap.size === 0) {
                throw new Error('Failed to fetch sheet data');
            }

            // Find the row for this symbol
            const price = priceMap.get(symbol);
            if (price === undefined) {
                console.error('❌ No data found for symbol:', symbol);
                return null;
            }

            const quote = {
                price: price,
                timestamp: new Date().getTime(),
                lastUpdate: new Date().toLocaleTimeString(),
                currency: 'USD'
            };
            
            console.log('✅ Received quote for', symbol, quote);
            
            this.cache.set(symbol, {
                data: quote,
                timestamp: now
            });

            return quote;
        } catch (error) {
            console.error('❌ Error fetching quote for', symbol, error);
            return null;
        }
    }

    async getBatchQuotes(symbols) {
        if (this.isUpdating) {
            console.log('⏳ Update already in progress, skipping...');
            return {};
        }

        try {
            this.isUpdating = true;
            console.log('🔄 Getting batch quotes for', symbols);
            
            const priceMap = await this.fetchSheetData();
            if (priceMap.size === 0) {
                throw new Error('Failed to fetch sheet data');
            }

            const result = {};
            
            symbols.forEach(symbol => {
                const price = priceMap.get(symbol);
                if (price !== undefined) {
                    result[symbol] = {
                        price: price,
                        timestamp: new Date().getTime(),
                        lastUpdate: new Date().toLocaleTimeString(),
                        currency: 'USD'
                    };
                }
            });

            console.log('✅ Batch quotes result:', result);
            return result;
        } catch (error) {
            console.error('❌ Error fetching batch quotes:', error);
            return {};
        } finally {
            this.isUpdating = false;
        }
    }

    async updateTradesWithMarketData(trades) {
        try {
            console.log('🔄 Updating trades with market data');
            const priceMap = await this.fetchSheetData();
            
            if (priceMap.size === 0) {
                console.log('❌ No price data available');
                return trades;
            }

            // Pre-calculate the current time for all updates
            const updateTime = new Date().toLocaleTimeString();
            
            // Use a single loop with optimized calculations
            const updatedTrades = trades.map(trade => {
                const price = priceMap.get(trade.ticker);
                
                if (price === undefined) {
                    console.log(`⚠️ No price found for ${trade.ticker}`);
                    return trade;
                }

                console.log(`✅ Found price for ${trade.ticker}: $${price}`);
                
                // Calculate values only if we have valid inputs
                const shares = trade.shares_remaining;
                const entryPrice = trade.avg_cost;
                
                if (shares && entryPrice) {
                    const marketValue = price * shares;
                    const priceDiff = price - entryPrice;
                    
                    return {
                        ...trade,
                        last_price: price,
                        market_value: marketValue,
                        unrealized_pnl: priceDiff * shares,
                        unrealized_pnl_percentage: (priceDiff / entryPrice) * 100,
                        last_update: updateTime
                    };
                }
                
                return {
                    ...trade,
                    last_price: price,
                    last_update: updateTime
                };
            });

            console.log('✅ Trades updated with latest prices');
            return updatedTrades;
        } catch (error) {
            console.error('❌ Error updating trades:', error);
            return trades;
        }
    }

    // Helper method to clear cache if needed
    clearCache() {
        this.priceMap.clear();
        this.lastFetchTime = 0;
        console.log('🧹 Cache cleared');
    }
}

export const marketDataService = new MarketDataService();