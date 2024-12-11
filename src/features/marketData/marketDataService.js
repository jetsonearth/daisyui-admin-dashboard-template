import { capitalService } from '../../services/capitalService';

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
                const [ticker, priceStr, lowStr] = row.split(',');
                if (ticker && priceStr && lowStr) {
                    const price = parseFloat(priceStr);
                    const low = parseFloat(lowStr);
                    if (!isNaN(price) && !isNaN(low)) {
                        this.priceMap.set(ticker.trim(), {
                            price: price,
                            low: low
                        });
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
            const symbolData = priceMap.get(symbol);
            if (symbolData === undefined) {
                console.error('❌ No data found for symbol:', symbol);
                return null;
            }

            const quote = {
                price: symbolData.price,
                low: symbolData.low,
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
                const symbolData = priceMap.get(symbol);
                if (symbolData !== undefined) {
                    result[symbol] = {
                        price: symbolData.price,
                        low: symbolData.low,
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
    
            const updateTime = new Date().toLocaleTimeString();
            
            // Get total account capital from capitalService
            const totalAccountCapital = await capitalService.getCurrentCapital();
            console.log('Total Account Capital:', totalAccountCapital);

            const updatedTrades = await Promise.all(trades.map(async (trade) => {
                const symbolData = priceMap.get(trade.ticker);
                
                if (symbolData === undefined) {
                    console.log(`⚠️ No price found for ${trade.ticker}`);
                    return trade;
                }
    
                const shares = trade.remaining_shares || trade.shares_remaining || trade.total_shares;
                const entryPrice = trade.entry_price || trade.avg_cost || trade.avg_entry_price;
                
                if (shares && entryPrice) {
                    const marketValue = symbolData.price * shares;
                    const priceDiff = symbolData.price - entryPrice;
                    const unrealizedPnL = priceDiff * shares;
                    const unrealizedPnLPercentage = (priceDiff / entryPrice) * 100;
    
                    // Open Risk - use the predefined initial risk amount
                    const initialRiskAmount = Math.abs(entryPrice - trade.stop_loss_price) * trade.total_shares;
                    
                    // Risk-Reward Ratio (RRR)
                    // RRR = (Unrealized PnL + Realized PnL) / Initial Risk Amount
                    const realizedPnL = trade.realized_pnl || 0;
                    const rrr = (unrealizedPnL + realizedPnL) / initialRiskAmount;

                    console.log('Portfolio Impact Calculation:', 
                        unrealizedPnL,
                        realizedPnL,
                        totalAccountCapital);
    
                    // Portfolio Impact - percentage impact on total account capital
                    const portfolioImpact = ((unrealizedPnL + realizedPnL) / totalAccountCapital) * 100;
                    
                    console.log('Portfolio Impact Calculation:', {
                        unrealizedPnL,
                        realizedPnL,
                        totalAccountCapital,
                        portfolioImpact
                    });
    
                    // Holding Period
                    const entryDate = new Date(trade.entry_date);
                    const exitDate = trade.exit_date ? new Date(trade.exit_date) : new Date();
                    const holdingPeriod = Math.round((exitDate - entryDate) / (1000 * 60 * 60 * 24)); // in days
    
                    // Weight Percentage - market value over account capital
                    const weightPercentage = (marketValue / totalAccountCapital) * 100;
                    console.log('🔵 EC:', totalAccountCapital);

                    console.log(`RRR Calculation for ${trade.ticker}:`, {
                        unrealizedPnL,
                        realizedPnL,
                        initialRiskAmount,
                        entryPrice: trade.entry_price,
                        stopLossPrice: trade.stop_loss_price,
                        shares: trade.total_shares
                    });
    
                    const calculatedTrade = {
                        ...trade,
                        last_price: symbolData.price,
                        low_price: symbolData.low,
                        market_value: marketValue,
                        unrealized_pnl: unrealizedPnL,
                        unrealized_pnl_percentage: unrealizedPnLPercentage,
                        open_risk: initialRiskAmount,
                        risk_reward_ratio: rrr,
                        portfolio_impact: portfolioImpact,
                        holding_period: holdingPeriod,
                        portfolio_weight: weightPercentage,
                        trimmed_percentage: 0, // As you specified
                        last_update: updateTime
                    };
    
                    return calculatedTrade;
                }
                
                return {
                    ...trade,
                    last_price: symbolData.price,
                    low_price: symbolData.low,
                    last_update: updateTime
                };
            }));

            await capitalService.recordDailyCapital(totalAccountCapital, {
                tradeCount: trades.length,
                marketDataUpdateTime: new Date().toISOString(),
                updatedTradesCount: updatedTrades.filter(trade => trade.last_update).length
            });
    
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
