// marketDataService.ts
import { Trade } from '../../types';
import { supabase } from '../../config/supabaseClient'
import { TRADE_STATUS } from '../../types';

interface Quote {
    price: number;
    timestamp: number;
    lastUpdate: string;
}

interface CachedQuote {
    data: Quote;
    timestamp: number;
}

class MarketDataService {
    private cache: Map<string, CachedQuote>;
    private cacheTimeout: number;
    private appScriptUrl: string;

    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 300000; // 5 minutes cache
        this.appScriptUrl = 'https://script.google.com/macros/s/AKfycbzI8SqpzF8YVYnAMSj5v0v0RKVUGS5we6omprT00IMxz2A_B-_8q65IWhq1pEl5MUgU/exec';
    }

    private async getUserId(): Promise<string> {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
            console.error('Authentication error:', userError);
            throw new Error('Please log in to fetch market data');
        }

        return user.id;
    }

    async getBatchQuotes(symbols: string[]): Promise<Record<string, Quote>> {
        if (!symbols || symbols.length === 0) {
            console.warn('No symbols provided for quotes');
            return {};
        }

        try {
            const userId = await this.getUserId();
            const now = Date.now();
            const result: Record<string, Quote> = {};
            const symbolsToFetch: string[] = [];

            // Only check cache for requested symbols
            for (const symbol of symbols) {
                const cached = this.cache.get(symbol);
                if (cached && (now - cached.timestamp) < this.cacheTimeout) {
                    console.log(`🔵 Using cached data for ${symbol}`, cached.data);
                    result[symbol] = cached.data;
                } else {
                    symbolsToFetch.push(symbol);
                }
            }

            // If all data was cached, return immediately
            if (symbolsToFetch.length === 0) {
                return result;
            }

            console.log(`🔄 Fetching fresh data for: ${symbolsToFetch.join(', ')}`);

            // Fetch fresh data for uncached symbols
            const response = await fetch(this.appScriptUrl, {
                redirect: "follow",
                method: 'POST',
                headers: {
                    'Content-Type': "text/plain;charset=utf-8"
                },
                body: JSON.stringify({
                    type: 'market_data',
                    userId,
                    tickers: symbolsToFetch
                })
            });

            // First get the text response
            const textResponse = await response.text();
            
            try {
                // Then parse it as JSON
                const data = JSON.parse(textResponse);
                
                if (!data || data.error) {
                    throw new Error(data?.error || 'Invalid response from server');
                }

                // Update cache and result with new data
                if (data.prices) {
                    Object.entries(data.prices).forEach(([symbol, price]) => {
                        const quote: Quote = {
                            price: price as number,
                            timestamp: now,
                            lastUpdate: data.timestamp
                        };
                        this.cache.set(symbol, { data: quote, timestamp: now });
                        result[symbol] = quote;
                    });
                }

                console.log('✅ Batch quotes fetched successfully');
                return result;

            } catch (error: any) {
                console.error('Error parsing response:', textResponse);
                throw new Error(`Failed to parse market data: ${error.message}`);
            }
        } catch (error) {
            console.error('❌ Error fetching quotes:', error);
            throw error;
        }
    }

    async getQuote(symbol: string): Promise<Quote | null> {
        try {
            const quotes = await this.getBatchQuotes([symbol]);
            return quotes[symbol] || null;
        } catch (error) {
            console.error(`❌ Error fetching quote for ${symbol}:`, error);
            return null;
        }
    }

    async updateTradesWithMarketData(trades: Trade[]): Promise<Trade[]> {
        if (!trades || trades.length === 0) {
            return trades;
        }

        try {
            // Only get market data for active trades
            const activeTrades = trades.filter(trade => trade.status === TRADE_STATUS.OPEN);
            const symbols = Array.from(new Set(activeTrades.map(trade => trade.ticker)));
            
            if (symbols.length === 0) {
                console.warn('No active trades found');
                return trades;
            }

            console.log(`🔄 Updating market data for ${symbols.length} active trades`);
            const quotes = await this.getBatchQuotes(symbols);
            
            return trades.map(trade => {
                // Skip closed trades
                if (trade.status !== TRADE_STATUS.OPEN) {
                    return trade;
                }
                
                const quote = quotes[trade.ticker];
                if (!quote) {
                    console.warn(`No quote data found for ticker: ${trade.ticker}`);
                    return trade;
                }
                
                return {
                    ...trade,
                    currentPrice: quote.price,
                    lastUpdate: quote.lastUpdate
                };
            });
        } catch (error) {
            console.error('❌ Error updating trades with market data:', error);
            return trades;
        }
    }

    async clearCacheForClosedTrades(trades: Trade[]) {
        const closedTrades = trades.filter(trade => trade.status !== TRADE_STATUS.OPEN);
        closedTrades.forEach(trade => {
            if (this.cache.has(trade.ticker)) {
                console.log(`🧹 Clearing cache for closed trade ${trade.ticker}`);
                this.cache.delete(trade.ticker);
            }
        });
    }

    clearCache() {
        this.cache.clear();
        console.log('🧹 Market data cache cleared');
    }
}

export const marketDataService = new MarketDataService();