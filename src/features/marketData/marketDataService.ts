// marketDataService.ts
import { Trade } from '../../types';
import { supabase } from '../../config/supabaseClient'
import { TRADE_STATUS } from '../../types';

export interface Quote {
    price: number;
    timestamp: number;
    lastUpdate: string;
}

export interface HistoricalPrices {
    minPrice: number;
    maxPrice: number;
    ticker: string;
    entryDate: string;
    exitDate: string;
    status: string;
}

export interface OHLCVData {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface OHLCVResponse {
    ohlcv: OHLCVData[];
    ticker: string;
    startDate: string;
    endDate: string;
    status: string;
    error?: string;  // Add this line
    message?: string; // Add this line for error messages
}

export interface CachedQuote {
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
        // this.appScriptUrl = 'https://script.google.com/macros/s/AKfycbzI8SqpzF8YVYnAMSj5v0v0RKVUGS5we6omprT00IMxz2A_B-_8q65IWhq1pEl5MUgU/exec';
        this.appScriptUrl = 'https://script.google.com/macros/s/AKfycbyHjm0QSFahHAgtiGafOYQlQfRUyLhKvytpF0qLAVgJFaX_3V_8QCHuO97wEmg7rPLM/exec';
    }

    private async getUserId(): Promise<string> {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
            console.error('Authentication error:', userError);
            throw new Error('Please log in to fetch market data');
        }

        return user.id;
    }

    async getHighLowPrices(ticker: string, entryDate: Date, exitDate: Date): Promise<HistoricalPrices> {
        try {
            const userId = await this.getUserId();
            console.log(`🔄 Fetching historical high/low prices for ${ticker} from ${entryDate} to ${exitDate}`);

            const response = await fetch(this.appScriptUrl, {
                redirect: "follow",
                method: 'POST',
                headers: {
                    'Content-Type': "text/plain;charset=utf-8"
                },
                body: JSON.stringify({
                    type: 'historical',
                    userId,
                    ticker,
                    entryDate: entryDate.toISOString(),
                    exitDate: exitDate.toISOString()
                })
            });

            const textResponse = await response.text();
            
            try {
                const data = JSON.parse(textResponse);
                
                if (!data || data.error) {
                    throw new Error(data?.error || 'Invalid response from server');
                }

                console.log('✅ Historical prices fetched successfully:', data);
                return data as HistoricalPrices;

            } catch (error: any) {
                console.error('Error parsing historical data response:', textResponse);
                throw new Error(`Failed to parse historical data: ${error.message}`);
            }
        } catch (error) {
            console.error('❌ Error fetching historical prices:', error);
            throw error;
        }
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

    async getOHLCVData(ticker: string, entryDate: Date, exitDate: Date): Promise<OHLCVData[]> {
        try {
            const userId = await this.getUserId();
            console.log(`🔄 Fetching OHLCV data for ${ticker} from ${entryDate} to ${exitDate}`);

            const response = await fetch(this.appScriptUrl, {
                redirect: "follow",
                method: 'POST',
                headers: {
                    'Content-Type': "text/plain;charset=utf-8"
                },
                body: JSON.stringify({
                    type: 'ohlcv',
                    userId,
                    ticker,
                    entryDate: entryDate.toISOString(),
                    exitDate: exitDate.toISOString()
                })
            });

            const textResponse = await response.text();
            
            try {
                const data = JSON.parse(textResponse) as (OHLCVResponse | { error: string; message: string });
                
                if ('error' in data) {
                    throw new Error(data.message || data.error || 'Invalid response from server');
                }
            
                console.log('✅ OHLCV data fetched successfully');
                return data.ohlcv;
            } catch (error: any) {
                console.error('Error parsing OHLCV data response:', textResponse);
                throw new Error(`Failed to parse OHLCV data: ${error.message}`);
            }
        } catch (error) {
            console.error('❌ Error fetching OHLCV data:', error);
            throw error;
        }
    }

    async updateTradesWithMarketData(trades: Trade[]): Promise<Trade[]> {
        // Only fetch market data for open trades
        const openTrades = trades.filter(trade => trade.status === TRADE_STATUS.OPEN);
        if (openTrades.length === 0) {
            return trades;
        }

        const symbols = [...new Set(openTrades.map(trade => trade.ticker))];
        const quotes = await this.getBatchQuotes(symbols);

        return trades.map(trade => {
            // For closed trades, return as is
            if (trade.status === TRADE_STATUS.CLOSED) {
                return trade;
            }

            const quote = quotes[trade.ticker];
            if (!quote) {
                return trade;
            }

            const currentPrice = quote.price;
            const unrealizedPnL = (currentPrice - trade.entry_price) * trade.remaining_shares;
            const unrealizedPnLPercentage = (unrealizedPnL / (trade.entry_price * trade.remaining_shares)) * 100;

            return {
                ...trade,
                last_price: currentPrice,
                unrealized_pnl: unrealizedPnL,
                unrealized_pnl_percentage: unrealizedPnLPercentage,
                market_value: trade.remaining_shares * currentPrice
            };
        });
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

    async testOHLCV() {
        const entryDate = new Date('2023-12-10');
        const exitDate = new Date('2023-12-15');
        const ticker = 'AAPL';

        console.log('🔄 Testing OHLCV data fetch...');
        console.log(`Ticker: ${ticker}`);
        console.log(`Entry Date: ${entryDate.toISOString()}`);
        console.log(`Exit Date: ${exitDate.toISOString()}`);

        try {
            const data = await this.getOHLCVData(ticker, entryDate, exitDate);
            
            console.log('\n✅ Successfully fetched OHLCV data:');
            console.log(`Number of candles: ${data.length}`);
            
            if (data.length > 0) {
                console.log('\nFirst 3 candles:');
                data.slice(0, 3).forEach(candle => {
                    console.log({
                        date: new Date(candle.time * 1000).toISOString(),
                        open: candle.open,
                        high: candle.high,
                        low: candle.low,
                        close: candle.close,
                        volume: candle.volume
                    });
                });

                console.log('\nLast 3 candles:');
                data.slice(-3).forEach(candle => {
                    console.log({
                        date: new Date(candle.time * 1000).toISOString(),
                        open: candle.open,
                        high: candle.high,
                        low: candle.low,
                        close: candle.close,
                        volume: candle.volume
                    });
                });
            }
            return data;
        } catch (error) {
            console.error('❌ Test failed:', error);
            throw error;
        }
    }
}

export const marketDataService = new MarketDataService();