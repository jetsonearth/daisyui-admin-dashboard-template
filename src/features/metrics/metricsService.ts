import { Trade, TRADE_STATUS } from '../../types';
import { supabase } from '../../config/supabaseClient';
import { tradeService } from '../../services/tradeService';
import { userSettingsService } from '../../services/userSettingsService';
import { marketDataService } from '../marketData/marketDataService';
import { capitalService } from '../../services/capitalService';
import { current } from '@reduxjs/toolkit';

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
    avgRRR: number;
    totalPnL: number;
    expectancy: number;           // (winRate * avgWin) - ((1 - winRate) * avgLoss)
    payoffRatio: number;         // avgWin / avgLoss
    totalTrades: number;         // Total number of trades
    profitableTradesCount: number;
    lossTradesCount: number;
    breakEvenTradesCount: number;
    largestWin: number;          // Biggest winning trade
    largestLoss: number;         // Biggest losing trade
}

interface StreakMetrics {
    currentStreak: number;
    longestWinStreak: number;
    longestLossStreak: number;
}

interface ExposureMetrics {
    // Daily Exposure (DE)
    der: number;           // Daily Exposure Risk
    dep: number;           // Daily Exposure Profit
    deltaDE: number;       // Delta DER/DEP

    // New Exposure (NE) - for trades opened in past week
    ner: number;           // New Exposure Risk
    nep: number;           // New Exposure Profit
    deltaNE: number;       // Delta NER/NEP

    // Open Exposure (OE)
    oer: number;           // Open Exposure Risk (Open Heat)
    oep: number;           // Open Exposure Profit
    deltaOE: number;       // Delta OER/OEP

    // Portfolio Allocation
    portfolioAllocation: number;  // Total capital in stocks / Total available capital
}

interface PortfolioMetrics {
    startingCapital: number;
    currentCapital: number;
    performanceMetrics: PerformanceMetrics;
    streakMetrics: StreakMetrics;
    exposureMetrics: ExposureMetrics;
    maxDrawdown: number;
    maxRunup: number;
}

interface CapitalSnapshot {
    date: string;
    totalValue: number;  // Realized + Unrealized
    highWaterMark: number;
    drawdown: number;
    runup: number;
}

// interface PerformanceMetrics {
//     // Existing metrics
//     winRate: number;
//     avgWin: number;
//     avgLoss: number;
//     profitFactor: number;
//     riskRewardRatio: number;

//     // New metrics
//     averageHoldingTime: number;  // Average duration of trades
//     averageDaysToProfit: number; // Average days for winning trades
//     averageDaysToLoss: number;   // Average days for losing trades
//     successByTimeOfDay: Record<string, number>; // Win rate by hour
//     successByDayOfWeek: Record<string, number>; // Win rate by day
//     consecutiveProfits: number;  // Current streak of profitable trades
//     consecutiveLosses: number;   // Current streak of losing trades
// }


export class MetricsService {
    private sum(numbers: number[]): number {
        return numbers.reduce((acc, curr) => acc + curr, 0);
    }

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

    async fetchTrades(): Promise<Trade[]> {

        console.log('-------- 🔄 Attempting to fetch trades --------');
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

    public async calculateTradeMetrics(
        trade: Trade, 
        // marketData: Map<string, { price: number; low: number }>, 
        marketData: Map<string, { price: number}>,
        startingCapital: number,
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
        const unrealizedPnL = priceDiff * trade.remaining_shares;
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

    // Add this to MetricsService
    public calculateStreakMetrics(trades: Trade[]): StreakMetrics {
        const closedTrades = trades
            .filter(t => t.status === TRADE_STATUS.CLOSED)
            .sort((a, b) => new Date(a.exit_datetime!).getTime() - new Date(b.exit_datetime!).getTime());
    
        let currentStreak = 0;
        let longestWinStreak = 0;
        let longestLossStreak = 0;
        let currentStreakType: 'win' | 'loss' | null = null;
    
        closedTrades.forEach(trade => {
            const isWin = trade.realized_pnl > 0;
            
            if (currentStreakType === null) {
                currentStreakType = isWin ? 'win' : 'loss';
                currentStreak = 1;
            } else if ((isWin && currentStreakType === 'win') || 
                       (!isWin && currentStreakType === 'loss')) {
                currentStreak++;
            } else {
                // Streak broken
                if (currentStreakType === 'win') {
                    longestWinStreak = Math.max(longestWinStreak, currentStreak);
                } else {
                    longestLossStreak = Math.max(longestLossStreak, currentStreak);
                }
                currentStreakType = isWin ? 'win' : 'loss';
                currentStreak = 1;
            }
        });
    
        // Update longest streaks one final time
        if (currentStreakType === 'win') {
            longestWinStreak = Math.max(longestWinStreak, currentStreak);
        } else if (currentStreakType === 'loss') {
            longestLossStreak = Math.max(longestLossStreak, currentStreak);
        }
    
        return {
            currentStreak,
            longestWinStreak,
            longestLossStreak
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
    
        const breakEvenTrades = closedTrades.filter(trade => 
            this.safeNumeric(trade.realized_pnl) === 0
        );
    
        const totalTrades = closedTrades.length;
        const winRate = totalTrades > 0 
            ? (profitableTrades.length / totalTrades) * 100 
            : 0;
    
        const avgWin = profitableTrades.length > 0
            ? profitableTrades.reduce((sum, trade) => 
                sum + this.safeNumeric(trade.realized_pnl), 0) / profitableTrades.length
            : 0;
    
        const avgLoss = lossTrades.length > 0
            ? Math.abs(lossTrades.reduce((sum, trade) => 
                sum + this.safeNumeric(trade.realized_pnl), 0) / lossTrades.length)
            : 0;
    
        const totalProfits = profitableTrades.reduce((sum, trade) => 
            sum + this.safeNumeric(trade.realized_pnl), 0);
        
        const totalLosses = Math.abs(lossTrades.reduce((sum, trade) => 
            sum + this.safeNumeric(trade.realized_pnl), 0));
    
        // Calculate largest win/loss
        const largestWin = profitableTrades.length > 0
            ? Math.max(...profitableTrades.map(t => this.safeNumeric(t.realized_pnl)))
            : 0;
    
        const largestLoss = lossTrades.length > 0
            ? Math.abs(Math.min(...lossTrades.map(t => this.safeNumeric(t.realized_pnl))))
            : 0;
        
        const profitFactor = totalLosses !== 0 
            ? totalProfits / totalLosses
            : totalProfits > 0 ? Number.POSITIVE_INFINITY : 0;
    
        const payoffRatio = avgLoss !== 0
            ? avgWin / avgLoss
            : avgWin > 0 ? Number.POSITIVE_INFINITY : 0;
    
        const expectancy = (winRate / 100 * avgWin) - ((1 - winRate / 100) * avgLoss);
    
        const totalPnL = totalProfits - totalLosses;
    
        const avgRRR = closedTrades.length > 0
            ? closedTrades.reduce((sum, trade) => 
                sum + this.safeNumeric(trade.risk_reward_ratio), 0) / closedTrades.length
            : 0;
    
        return {
            winRate,
            avgWin,
            avgLoss,
            profitFactor,
            avgRRR,
            totalPnL,
            expectancy,
            payoffRatio,
            totalTrades,
            profitableTradesCount: profitableTrades.length,
            lossTradesCount: lossTrades.length,
            breakEvenTradesCount: breakEvenTrades.length,
            largestWin,
            largestLoss
        };
    }

    // Calculate exposure metrics
    public async calculateExposureMetrics(trades: Trade[], currentCapital: number): Promise<ExposureMetrics> {
        log('info', 'Calculating exposure metrics');
    
        const marketData = await marketDataService.fetchSheetData();
        const today = new Date();
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
        // Filter trades by timeframes
        const todayTrades = trades.filter(trade => 
            trade.entry_datetime && new Date(trade.entry_datetime).toDateString() === today.toDateString()
        );
        const recentTrades = trades.filter(trade => 
            trade.entry_datetime && new Date(trade.entry_datetime) >= weekAgo
        );
        const openTrades = trades.filter(trade => 
            trade.status === TRADE_STATUS.OPEN
        );
    
        // Calculate Daily Exposure metrics
        const der = todayTrades.reduce((sum, trade) => 
            sum + this.safeNumeric(trade.open_risk) / currentCapital * 100, 0);
    
        const dep = todayTrades.reduce((sum, trade) => {
            const marketQuote = marketData.get(trade.ticker);
            if (!marketQuote) return sum;
            const unrealizedPnL = (marketQuote.price - trade.entry_price) * trade.remaining_shares;
            return sum + (unrealizedPnL / currentCapital * 100);
        }, 0);
    
        // Calculate New Exposure metrics (past week)
        const ner = recentTrades.reduce((sum, trade) => 
            sum + this.safeNumeric(trade.open_risk) / currentCapital * 100, 0);
    
        const nep = recentTrades.reduce((sum, trade) => {
            const marketQuote = marketData.get(trade.ticker);
            if (!marketQuote) return sum;
            const unrealizedPnL = (marketQuote.price - trade.entry_price) * trade.remaining_shares;
            return sum + (unrealizedPnL / currentCapital * 100);
        }, 0);
    
        // Calculate Open Exposure metrics
        const oer = openTrades.reduce((sum, trade) => 
            sum + this.safeNumeric(trade.open_risk) / currentCapital * 100, 0);
    
        const oep = openTrades.reduce((sum, trade) => {
            const marketQuote = marketData.get(trade.ticker);
            if (!marketQuote) return sum;
            const unrealizedPnL = (marketQuote.price - trade.entry_price) * trade.remaining_shares;
            const realizedPnL = this.safeNumeric(trade.realized_pnl);
            return sum + ((unrealizedPnL + realizedPnL) / currentCapital * 100);
        }, 0);
    
        // Calculate existing metrics
        const portfolioAllocation = openTrades.reduce((sum, trade) => {
            const marketQuote = marketData.get(trade.ticker);
            if (!marketQuote) return sum;
            const unrealizedPnL = (marketQuote.price - trade.entry_price) * trade.remaining_shares;
            const realizedPnL = this.safeNumeric(trade.realized_pnl);
            return sum + unrealizedPnL + realizedPnL;
        }, 0) / currentCapital * 100;
        console.log(" -------- CURR CAP: ---------- ", currentCapital);
        console.log(" -------- Portfolio Allocation: ----------", portfolioAllocation);
    
        // const maxSingleTradeExposure = Math.max(...trades.map(trade => {
        //     const marketQuote = marketData.get(trade.ticker);
        //     if (!marketQuote) return 0;
        //     return this.safeNumeric(marketQuote.price * trade.remaining_shares);
        // }));
    
        // const portfolioHeat = (totalExposure / currentCapital) * 100;
    
        // Delta calculations (simple change from previous values - you might want to store/track these)
        const deltaDE = dep - der;
        const deltaNE = nep - ner;
        const deltaOE = oep - oer;
    
        return {
            // Daily Exposure
            der,
            dep,
            deltaDE,
    
            // New Exposure
            ner,
            nep,
            deltaNE,
    
            // Open Exposure
            oer,
            oep,
            deltaOE,
    
            // Current metrics
            portfolioAllocation
        };
    }

    // Calculate comprehensive portfolio metrics
    async calculatePortfolioMetrics(
        trades: Trade[] | null = null, 
        startingCapital: number | null = null
    ): Promise<PortfolioMetrics> {
        try {
            // 1. Get and validate trades
            const validatedTrades = this.validateTrades(trades || await this.fetchTrades());
            
            // 2. Get starting capital (could be moved to app initialization)
            const actualStartingCapital = startingCapital ?? 
                (await userSettingsService.getUserSettings()).starting_cash ?? 
                25000;
    
            // 3. Calculate current portfolio state
            const currentCapital = await capitalService.calculateCurrentCapital();

            // console.log('Starting Capital:', actualStartingCapital);
            // console.log('Current Capital:', currentCapital);
            // console.log('Trades:', validatedTrades);
    
            // 4. Calculate actual metrics
            const performanceMetrics = this.calculateTradePerformanceMetrics(validatedTrades);
            const exposureMetrics = await this.calculateExposureMetrics(
                validatedTrades, 
                currentCapital
            );
    
            // In calculatePortfolioMetrics:
            const { maxDrawdown, maxRunup } = await this.calculateMaxDrawdownAndRunup(validatedTrades);

            return {
                startingCapital: actualStartingCapital,
                currentCapital,
                performanceMetrics,
                exposureMetrics,
                streakMetrics: this.calculateStreakMetrics(validatedTrades),
                maxDrawdown,
                maxRunup
            };
        } catch (error) {
            log('error', 'Portfolio metrics calculation failed', { error });
            throw error;
        }
    }

    public async calculateMaxDrawdownAndRunup(trades: Trade[]): Promise<{maxDrawdown: number, maxRunup: number}> {
        try {
            // Get capital changes data
            const { data: capitalChanges } = await supabase
                .from('capital_changes')
                .select('*')
                .order('date', { ascending: true });
    
            if (!capitalChanges || capitalChanges.length === 0) {
                return { maxDrawdown: 0, maxRunup: 0 };
            }
    
            let highWaterMark = -Infinity;
            let maxDrawdown = 0;
            let maxRunup = 0;
            let lastValue: number | null = null; // Explicitly define the type
    
            capitalChanges.forEach(change => {
                const metadata = JSON.parse(change.metadata);
                const totalValue = change.capital_amount;
                const dayHigh = metadata.day_high || totalValue;
                const dayLow = metadata.day_low || totalValue;
    
                if (dayHigh > highWaterMark) {
                    highWaterMark = dayHigh;
                    if (lastValue !== null) {
                        const runup = ((dayHigh - lastValue) / lastValue) * 100;
                        maxRunup = Math.max(maxRunup, runup);
                    }
                }
    
                const drawdown = ((highWaterMark - dayLow) / highWaterMark) * 100;
                maxDrawdown = Math.max(maxDrawdown, drawdown);
    
                lastValue = totalValue; // Use EOD value for next day's comparison
            });
    
            return { maxDrawdown, maxRunup };
        } catch (error) {
            log('error', 'Error calculating max drawdown and runup:', error);
            return { maxDrawdown: 0, maxRunup: 0 };
        }
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
        const currentCapital = await capitalService.calculateCurrentCapital();
    
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
        // try {
        //     await capitalService.updateCurrentCapital(currentCapital, {
        //         tradeCount: trades.length,
        //         marketDataUpdateTime: new Date().toISOString(),
        //         updatedTradesCount: updatedTrades.length,
        //         realizedPnL: totalRealizedPnL,
        //         unrealizedPnL: totalUnrealizedPnL
        //     });
        // } catch (error) {
        //     log('error', 'Failed to update capital service', error);
        // }
    
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

    public async upsertTradingMetrics(
        userId: string,
        performanceMetrics: PerformanceMetrics,
        exposureMetrics: ExposureMetrics
    ): Promise<void> {
        const today = new Date().toISOString().split('T')[0];  // YYYY-MM-DD
    
        const { error } = await supabase
            .from('trading_metrics')
            .upsert({
                user_id: userId,
                date: today,
                // Performance Metrics
                win_rate: performanceMetrics.winRate,
                avg_win: performanceMetrics.avgWin,
                avg_loss: performanceMetrics.avgLoss,
                profit_factor: performanceMetrics.profitFactor,
                avg_rrr: performanceMetrics.avgRRR,
                total_pnl: performanceMetrics.totalPnL,
                expectancy: performanceMetrics.expectancy,
                payoff_ratio: performanceMetrics.payoffRatio,
                total_trades: performanceMetrics.totalTrades,
                profitable_trades_count: performanceMetrics.profitableTradesCount,
                loss_trades_count: performanceMetrics.lossTradesCount,
                break_even_trades_count: performanceMetrics.breakEvenTradesCount,
                largest_win: performanceMetrics.largestWin,
                largest_loss: performanceMetrics.largestLoss,
                
                // Exposure Metrics
                der: exposureMetrics.der,
                dep: exposureMetrics.dep,
                delta_de: exposureMetrics.deltaDE,
                ner: exposureMetrics.ner,
                nep: exposureMetrics.nep,
                delta_ne: exposureMetrics.deltaNE,
                oer: exposureMetrics.oer,
                oep: exposureMetrics.oep,
                delta_oe: exposureMetrics.deltaOE,
                portfolio_allocation: exposureMetrics.portfolioAllocation,
                
                updated_at: new Date().toISOString()
            })
            .select();
    
        if (error) throw error;
    }

}

// Export an instance of the service
export const metricsService = new MetricsService();

// Export the method directly for easier import
export const calculatePortfolioMetrics = (
    trades: Trade[] | null = null, 
    startingCapital: number | null = null
) => metricsService.calculatePortfolioMetrics(trades, startingCapital);