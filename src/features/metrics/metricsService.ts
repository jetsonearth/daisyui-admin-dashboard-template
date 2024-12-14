import { Trade, TRADE_STATUS } from '../../types';
import { supabase } from '../../config/supabaseClient';
import { tradeService } from '../../services/tradeService';
import { userSettingsService } from '../../services/userSettingsService';
import { marketDataService } from '../marketData/marketDataService';
import { capitalService } from '../../services/capitalService';

// Logging utility with file prefix
const log = (level: 'info' | 'warn' | 'error', message: string, data?: any) => {
    const prefix = '[MetricsService]';
    const logMessage = `${prefix} ${message}`;
    
    switch(level) {
        case 'info':
            console.log(logMessage, data ? data : '');
            break;
        case 'warn':
            console.warn(logMessage, data ? data : '');
            break;
        case 'error':
            console.error(logMessage, data ? data : '');
            break;
    }
};

// Interfaces for metrics calculations
interface PerformanceMetrics {
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    riskRewardRatio: number;
}

interface StreakMetrics {
    currentStreak: number;
    longestWinStreak: number;
    longestLossStreak: number;
}

interface ExposureMetrics {
    totalExposure: number;
    maxSingleTradeExposure: number;
    portfolioHeat: number;
}

interface PortfolioMetrics {
    startingCapital: number;
    currentCapital: number;
    performanceMetrics: PerformanceMetrics;
    streakMetrics: StreakMetrics;
    exposureMetrics: ExposureMetrics;
    totalRealizedPnL: number;
    totalUnrealizedPnL: number;
    maxDrawdown: number;
    maxRunup: number;
}

export class MetricsService {
    // Safely convert value to number with optional default
    public safeNumeric(value: any, defaultValue: number = 0): number {
        const numValue = Number(value);
        return isNaN(numValue) ? defaultValue : numValue;
    }

    // Validate and clean trades input
    public validateTrades(trades: Trade[]): Trade[] {
        log('info', 'Validating trades', { tradesCount: trades.length });
        
        return trades.filter(trade => {
            const isValid = trade && 
                            trade.ticker && 
                            trade.status !== undefined &&
                            trade.entry_price !== undefined;
            
            if (!isValid) {
                log('warn', 'Invalid trade filtered out', { trade });
            }
            
            return isValid;
        });
    }

    public async calculateTradeMetrics(
        trade: Trade, 
        // marketData: Map<string, { price: number; low: number }>, 
        marketData: Map<string, { price: number}>,
        startingCash: number, 
        totalCapital: number
    ): Promise<{
        trimmedPercentage: number;
        unrealizedPnL: number;
        unrealizedPnLPercentage: number;
        marketValue: number;
        portfolioWeight: number;
        portfolioImpact: number;
        portfolioHeat: number;
        riskRewardRatio: number;
        lastPrice: number;
        realizedPnL: number;
        realizedPnLPercentage: number;
    }> {
        const symbolData = marketData.get(trade.ticker);
        if (!symbolData) {
            log('warn', `No market data found for ticker: ${trade.ticker}`);
            return {
                trimmedPercentage: 0,
                unrealizedPnL: 0,
                unrealizedPnLPercentage: 0,
                marketValue: 0,
                portfolioWeight: 0,
                portfolioImpact: 0,
                portfolioHeat: 0,
                riskRewardRatio: 0,
                lastPrice: trade.entry_price,
                realizedPnL: 0,
                realizedPnLPercentage: 0
            };
        }
    
        const marketPrice = symbolData.price;
        const shares = trade.remaining_shares || trade.total_shares;
        const entryPrice = trade.entry_price;
        const realizedPnL = this.safeNumeric(trade.realized_pnl);
    
        // Trimmed Percentage
        const trimmedPercentage = ((trade.total_shares - shares) / trade.total_shares) * 100;
    
        // Market Value
        const marketValue = marketPrice * shares;
    
        // Unrealized PnL
        const priceDiff = marketPrice - entryPrice;
        const unrealizedPnL = priceDiff * shares;
        const unrealizedPnLPercentage = (priceDiff / entryPrice) * 100;
    
        // Open Risk - use the predefined initial risk amount
        const initialRiskAmount = Math.abs(entryPrice - trade.stop_loss_price) * trade.total_shares;
    
        // Risk-Reward Ratio (RRR)
        const riskRewardRatio = initialRiskAmount > 0 
            ? (unrealizedPnL + realizedPnL) / initialRiskAmount 
            : 0;
    
        // Portfolio Weight
        const portfolioWeight = (marketValue / totalCapital) * 100;
    
        // Portfolio Impact
        const portfolioImpact = ((unrealizedPnL + realizedPnL) / totalCapital) * 100;
    
        // Portfolio Heat
        const portfolioHeat = (Math.abs(trade.open_risk) / totalCapital) * 100;

        // Realized PnL Percentage
        const realizedPnLPercentage = (realizedPnL / (trade.total_shares * entryPrice)) * 100;
    
        return {
            trimmedPercentage,
            unrealizedPnL,
            unrealizedPnLPercentage,
            marketValue,
            portfolioWeight,
            portfolioImpact,
            portfolioHeat,
            riskRewardRatio,
            lastPrice: marketPrice,
            realizedPnL,
            realizedPnLPercentage
        };
    }


    // Calculate performance metrics for trades
    public calculateTradePerformanceMetrics(trades: Trade[]): PerformanceMetrics {
        log('info', 'Calculating trade performance metrics');

        const closedTrades = trades.filter(trade => 
            trade.status === TRADE_STATUS.CLOSED
        );

        const profitableTrades = closedTrades.filter(trade => 
            this.safeNumeric(trade.realized_pnl) > 0
        );

        const lossTrades = closedTrades.filter(trade => 
            this.safeNumeric(trade.realized_pnl) < 0
        );

        const winRate = closedTrades.length > 0 
            ? (profitableTrades.length / closedTrades.length) * 100 
            : 0;

        const avgWin = profitableTrades.length > 0
            ? profitableTrades.reduce((sum, trade) => 
                sum + this.safeNumeric(trade.realized_pnl), 0) / profitableTrades.length
            : 0;

        const avgLoss = lossTrades.length > 0
            ? Math.abs(lossTrades.reduce((sum, trade) => 
                sum + this.safeNumeric(trade.realized_pnl), 0) / lossTrades.length)
            : 0;

        const profitFactor = avgLoss !== 0 
            ? Math.abs(avgWin / avgLoss)
            : 0;

        const riskRewardRatio = avgLoss !== 0 
            ? Math.abs(avgWin / avgLoss)
            : 0;

        return {
            winRate,
            avgWin,
            avgLoss,
            profitFactor,
            riskRewardRatio
        };
    }

    // Calculate current capital based on trades
    public async calculateCurrentCapital(trades: Trade[], startingCapital: number): Promise<{ 
        currentCapital: number, 
        totalRealizedPnL: number, 
        totalUnrealizedPnL: number 
    }> {
        log('info', 'Calculating current capital', { 
            startingCapital, 
            tradesCount: trades.length 
        });
    
        // Fetch latest market data
        const marketData = await marketDataService.fetchSheetData();
    
        let totalRealizedPnL = 0;
        let totalUnrealizedPnL = 0;
    
        const processedTrades = trades.map(trade => {
            const symbolData = marketData.get(trade.ticker);
            
            if (symbolData === undefined) {
                log('warn', `No price found for ${trade.ticker}`);
                return { trade, unrealizedPnL: 0 };
            }
    
            const shares = trade.remaining_shares || trade.total_shares;
            const entryPrice = trade.entry_price;
            
            if (shares && entryPrice) {
                const marketValue = symbolData.price * shares;
                const priceDiff = symbolData.price - entryPrice;
                const unrealizedPnL = priceDiff * shares;
    
                // Accumulate PnL
                totalRealizedPnL += this.safeNumeric(trade.realized_pnl);
                totalUnrealizedPnL += unrealizedPnL;
    
                return { 
                    trade, 
                    unrealizedPnL,
                    marketPrice: symbolData.price
                };
            }
    
            return { trade, unrealizedPnL: 0 };
        });
    
        console.log("🚀 Total Realized PnL:", totalRealizedPnL);
        console.log("🚀 Total Unrealized PnL:", totalUnrealizedPnL);
    
        const currentCapital = this.safeNumeric(startingCapital) + totalRealizedPnL + totalUnrealizedPnL;
    
        log('info', 'Current capital detailed breakdown', {
            startingCapital,
            totalRealizedPnL,
            totalUnrealizedPnL,
            currentCapital
        });
    
        return { 
            currentCapital, 
            totalRealizedPnL, 
            totalUnrealizedPnL 
        };
    }

    // Calculate exposure metrics
    public async calculateExposureMetrics(trades: Trade[], currentCapital: number): Promise<ExposureMetrics> {
        log('info', 'Calculating exposure metrics');
    
        // Fetch latest market data
        const marketData = await marketDataService.fetchSheetData();
    
        const totalExposure = trades.reduce((sum, trade) => {
            const marketQuote = marketData.get(trade.ticker);
            if (!marketQuote) {
                log('warn', `No market data found for ticker: ${trade.ticker}`, { trade });
                return sum;
            }
            const marketValue = this.safeNumeric(marketQuote.price * trade.remaining_shares);
            return sum + marketValue;
        }, 0);
    
        const maxSingleTradeExposure = Math.max(...trades.map(trade => {
            const marketQuote = marketData.get(trade.ticker);
            if (!marketQuote) return 0;
            return this.safeNumeric(marketQuote.price * trade.remaining_shares);
        }));
    
        const portfolioHeat = (totalExposure / currentCapital) * 100;
    
        return {
            totalExposure,
            maxSingleTradeExposure,
            portfolioHeat
        };
    }

    async fetchTrades(): Promise<Trade[]> {
        try {
            log('info', 'Attempting to fetch trades');
            
            const { data } = await supabase.auth.getUser();
            if (!data.user) {
                log('error', 'No authenticated user found');
                return []; // Return empty array instead of throwing
            }

            // Fetch trades directly using Supabase query
            const { data: trades, error } = await supabase
                .from('trades')
                .select('*')
                .eq('user_id', data.user.id)
                .order('entry_datetime', { ascending: false });

            if (error) throw error;

            log('info', 'Trades fetched successfully', { 
                tradesCount: trades.length,
                tradeStatuses: trades.map(trade => trade.status)
            });

            return trades || [];
        } catch (error) {
            log('error', 'Error fetching trades', { 
                errorMessage: (error as Error).message,
                errorStack: (error as Error).stack 
            });
            return []; 
        }
    }

    // Calculate comprehensive portfolio metrics
    async calculatePortfolioMetrics(
        trades: Trade[] | null = null, 
        startingCapital: number | null = null
    ): Promise<PortfolioMetrics> {
        log('info', 'Calculating Portfolio Metrics');
    
        // Fetch trades if not provided
        if (!trades || trades.length === 0) {
            trades = await this.fetchTrades();
        }
    
        // Validate and clean trades
        trades = this.validateTrades(trades);
    
        // Retrieve starting capital if not provided
        if (startingCapital === null) {
            try {
                const userSettings = await userSettingsService.getUserSettings();
                startingCapital = userSettings.starting_cash || 13000;
                
                log('info', 'Starting capital retrieved', { 
                    startingCapital,
                    source: 'userSettings' 
                });
            } catch (error) {
                log('warn', 'Failed to retrieve starting capital', {
                    errorMessage: (error as Error).message,
                    usingDefaultValue: 13000
                });
                startingCapital = 13000;
            }
        }
    
        // Fetch market data for all trade tickers
        const marketData = await marketDataService.fetchSheetData();
    
        // Calculate trade-level metrics
        const tradeMetrics = await Promise.all(
            trades.map(trade => this.calculateTradeMetrics(
                trade, 
                marketData, 
                startingCapital, 
                startingCapital // This will be updated in calculateCurrentCapital
            ))
        );
    
        // Calculate current capital
        const { 
            currentCapital, 
            totalRealizedPnL, 
            totalUnrealizedPnL 
        } = await this.calculateCurrentCapital(trades, startingCapital);
    
        // Calculate metrics
        const performanceMetrics = this.calculateTradePerformanceMetrics(trades);
        const exposureMetrics = await this.calculateExposureMetrics(trades, currentCapital);
    
        // Placeholder for streak and drawdown metrics
        const streakMetrics: StreakMetrics = {
            currentStreak: 0,
            longestWinStreak: 0,
            longestLossStreak: 0
        };
    
        return {
            startingCapital,
            currentCapital,
            performanceMetrics,
            streakMetrics,
            exposureMetrics,
            totalRealizedPnL,
            totalUnrealizedPnL,
            maxDrawdown: 0,
            maxRunup: 0
        };
    }

    async updateTradesWithDetailedMetrics(trades?: Trade[]): Promise<Trade[]> {
        log('info', 'Updating trades with detailed metrics');
    
        // Fetch trades if not provided
        if (!trades || trades.length === 0) {
            trades = await this.fetchTrades();
        }
    
        // Fetch market data
        const marketData = await marketDataService.fetchSheetData();
    
        // Get starting capital
        const startingCapital = await this.retrieveStartingCapital();
    
        // Calculate current capital to get total capital for metrics
        const { 
            currentCapital, 
            totalRealizedPnL, 
            totalUnrealizedPnL 
        } = await this.calculateCurrentCapital(trades, startingCapital);
    
        // Process trades with detailed metrics
        const updatedTrades = await Promise.all(trades.map(async (trade) => {
            // Calculate trade-specific metrics
            const tradeMetrics = await this.calculateTradeMetrics(
                trade, 
                marketData, 
                startingCapital, 
                currentCapital
            );
    
            // Prepare trade update payload
            const tradeUpdate = {
                last_price: tradeMetrics.lastPrice,
                market_value: tradeMetrics.marketValue,
                unrealized_pnl: tradeMetrics.unrealizedPnL,
                unrealized_pnl_percentage: tradeMetrics.unrealizedPnLPercentage,
                realized_pnl: tradeMetrics.realizedPnL,
                realized_pnl_percentage: tradeMetrics.realizedPnLPercentage,
                trimmed_percentage: tradeMetrics.trimmedPercentage,
                portfolio_weight: tradeMetrics.portfolioWeight,
                portfolio_impact: tradeMetrics.portfolioImpact,
                portfolio_heat: tradeMetrics.portfolioHeat,
                risk_reward_ratio: tradeMetrics.riskRewardRatio,
                updated_at: new Date().toISOString()
            };
    
            // Update trade in Supabase
            try {
                await tradeService.updateTrade(trade.id, tradeUpdate);
                log('info', `Successfully updated trade ${trade.id} metrics`);
            } catch (error) {
                log('error', `Failed to update trade ${trade.id} metrics`, error);
            }
    
            return {
                ...trade,
                ...tradeUpdate
            };
        }));
    
        // Update capital service with total metrics
        try {
            await capitalService.updateCurrentCapital(currentCapital, {
                tradeCount: trades.length,
                marketDataUpdateTime: new Date().toISOString(),
                updatedTradesCount: updatedTrades.length,
                realizedPnL: totalRealizedPnL,
                unrealizedPnL: totalUnrealizedPnL
            });
        } catch (error) {
            log('error', 'Failed to update capital service', error);
        }
    
        // Update user settings with current capital
        try {
            await userSettingsService.updateUserSettings({
                current_capital: currentCapital
            });
            log('info', `Updated current capital to ${currentCapital}`);
        } catch (error) {
            log('error', 'Failed to update user settings', error);
        }
    
        return updatedTrades;
    }
    
    // Helper method to retrieve starting capital
    public async retrieveStartingCapital(): Promise<number> {
        try {
            const currentSettings = await userSettingsService.getUserSettings();
            return this.safeNumeric(currentSettings.starting_cash) || 25000; // Default to 25000 if not found
        } catch (error) {
            log('warn', 'Failed to retrieve starting capital, using default', error);
            return 25000;
        }
    }

}

// Export an instance of the service
export const metricsService = new MetricsService();

// Export the method directly for easier import
export const calculatePortfolioMetrics = (
    trades: Trade[] | null = null, 
    startingCapital: number | null = null
) => metricsService.calculatePortfolioMetrics(trades, startingCapital);