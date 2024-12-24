import { Trade, TRADE_STATUS } from '../../types';
import { supabase } from '../../config/supabaseClient';
import { tradeService } from '../../services/tradeService';
import { userSettingsService } from '../../services/userSettingsService';
import { marketDataService } from '../marketData/marketDataService';
import { capitalService } from '../../services/capitalService';

import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isToday from 'dayjs/plugin/isToday';  // Use this instead of isSame for checking same day

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(isToday);

// Logging utility
const log = (level: 'info' | 'warn' | 'error', message: string, data?: any) => {
    const prefix = '[MetricsService]';
    switch (level) {
        case 'info':
            console.log(`${prefix} ${message}`, data || '');
            break;
        case 'warn':
            console.warn(`${prefix} ${message}`, data || '');
            break;
        case 'error':
            console.error(`${prefix} ${message}`, data || '');
            break;
    }
};

// Interfaces for metrics calculations
interface PerformanceMetrics {
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    expectancy: number;
    payoffRatio: number;
    totalTrades: number;
    profitableTradesCount: number;
    lossTradesCount: number;
    breakEvenTradesCount: number;
    totalProfits: number;
    totalLosses: number;
    largestWin: number;
    largestLoss: number;
    avgWinR: number;
    avgLossR: number;
    avgRRR: number;
    currentStreak?: number;
    longestWinStreak?: number;
    longestLossStreak?: number;
    avgGainPercentage: number;
    avgLossPercentage: number;
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
    // portfolioAllocation: number;  // Total capital in stocks / Total available capital
}

interface PortfolioMetrics {
    startingCapital: number;
    currentCapital: number;
    performanceMetrics: PerformanceMetrics;
    streakMetrics: StreakMetrics;
    exposureMetrics: ExposureMetrics;
}

interface CapitalSnapshot {
    date: string;
    totalValue: number;  // Realized + Unrealized
    highWaterMark: number;
    drawdown: number;
    runup: number;
}

interface Quote {
    price: number;
    timestamp: number;
    lastUpdate: string;
}

export class MetricsService {
    private metricsCache: {
        data: any;
        timestamp: number;
    } | null = null;

    private readonly CACHE_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds
    
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

    private calculateCurrentRiskAmount(trade: Trade, currentPrice: number): number {
        if (trade.status === TRADE_STATUS.CLOSED) return 0;
        
        const remainingShares = trade.remaining_shares;
        
        // If trailing stop is set
        if (trade.trailing_stoploss) {
            return trade.direction === 'LONG'
                ? (currentPrice - trade.trailing_stoploss) * remainingShares
                : (trade.trailing_stoploss - currentPrice) * remainingShares;
        }
        
        // If no trailing stop, use original stop based on open_risk
        const stopPrice = trade.direction === 'LONG'
            ? trade.entry_price * (1 - trade.open_risk / 100)
            : trade.entry_price * (1 + trade.open_risk / 100);
        
        return trade.direction === 'LONG'
            ? (currentPrice - stopPrice) * remainingShares
            : (stopPrice - currentPrice) * remainingShares;
    }

    public async calculateTradeMetrics(
        trade: Trade, 
        quotes: Record<string, Quote>, 
        startingCapital: number,
        currentCapital: number
    ): Promise<{
        trimmedPercentage: number;
        unrealizedPnL: number;
        unrealizedPnLPercentage: number;
        marketValue: number;
        portfolioWeight: number;
        portfolioImpact: number;
        riskRewardRatio: number;
        lastPrice: number;
        realizedPnL: number;
        realizedPnLPercentage: number;
        current_risk_amount: number;
        initial_position_risk: number;
        current_var: number;
    }> {
        // For closed trades, use exit price and skip market data
        if (trade.status === TRADE_STATUS.CLOSED) {
            return {
                lastPrice: trade.exit_price || 0,
                marketValue: 0,
                unrealizedPnL: 0,
                unrealizedPnLPercentage: 0,
                realizedPnL: trade.realized_pnl || 0,
                realizedPnLPercentage: trade.realized_pnl ? (trade.realized_pnl / (trade.entry_price * trade.total_shares)) * 100 : 0,
                trimmedPercentage: 100,
                portfolioWeight: 0,
                portfolioImpact: 0,
                current_risk_amount: 0,
                initial_position_risk: 0,
                current_var: 0,
                riskRewardRatio: trade.realized_pnl ? trade.realized_pnl / trade.initial_risk_amount! : 0
            };
        }

        // For active trades, calculate metrics using market data
        const quote = quotes[trade.ticker];
        if (!quote) {
            const currentRiskAmount = this.calculateCurrentRiskAmount(trade, trade.entry_price);
            const initialPositionRisk = ((trade.initial_risk_amount || 0) / currentCapital) * 100;
            return {
                lastPrice: trade.entry_price,
                marketValue: trade.remaining_shares * trade.entry_price,
                unrealizedPnL: 0,
                unrealizedPnLPercentage: 0,
                realizedPnL: trade.realized_pnl || 0,
                realizedPnLPercentage: (trade.realized_pnl || 0) / (trade.entry_price * trade.total_shares) * 100,
                trimmedPercentage: ((trade.total_shares - trade.remaining_shares) / trade.total_shares) * 100,
                portfolioWeight: (trade.remaining_shares * trade.entry_price / currentCapital) * 100,
                portfolioImpact: ((trade.realized_pnl || 0) / startingCapital) * 100,
                current_risk_amount: currentRiskAmount,
                initial_position_risk: initialPositionRisk,
                current_var: (currentRiskAmount / currentCapital) * 100,
                riskRewardRatio: (trade.unrealized_pnl + trade.realized_pnl) / (currentRiskAmount || 1)
            };
        }

        const currentPrice = quote.price;
        // Calculate metrics
        const marketValue = trade.remaining_shares * currentPrice;
        const unrealizedPnL = (currentPrice - trade.entry_price) * trade.remaining_shares;
        const unrealizedPnLPercentage = (unrealizedPnL / (trade.entry_price * trade.remaining_shares)) * 100;
        const realizedPnL = trade.realized_pnl || 0;
        const realizedPnLPercentage = (realizedPnL / (trade.entry_price * trade.total_shares)) * 100;
        const trimmedPercentage = ((trade.total_shares - trade.remaining_shares) / trade.total_shares) * 100;
        
        // Portfolio metrics
        const portfolioWeight = (marketValue / currentCapital) * 100;
        const portfolioImpact = ((unrealizedPnL + realizedPnL) / startingCapital) * 100;
        
        // Risk metrics
        const currentRiskAmount = this.calculateCurrentRiskAmount(trade, currentPrice);
        const initialPositionRisk = ((trade.initial_risk_amount!) / currentCapital) * 100;

        // console.log('------------------------ Current Cap:', currentCapital);
        // console.log('------------------------ Initial Position Risk:', initialPositionRisk);

        const current_var = (currentRiskAmount / currentCapital) * 100;
        // console.log('------------------------ Current VAR:', current_var);
        // Risk reward ratio using current risk amount
        const riskRewardRatio = (unrealizedPnL + realizedPnL) / (trade.initial_risk_amount!);

        return {
            lastPrice: currentPrice,
            marketValue,
            unrealizedPnL,
            unrealizedPnLPercentage,
            realizedPnL,
            realizedPnLPercentage,
            trimmedPercentage,
            portfolioWeight,
            portfolioImpact,
            current_risk_amount: currentRiskAmount,
            initial_position_risk: initialPositionRisk,
            current_var,
            riskRewardRatio
        };
    }

    ///////// Compute using Closed Trades Only ////////
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

        let totalProfits = 0;
        let totalLosses = 0;
        let totalGainPercentage = 0;
        let totalLossPercentage = 0;

        profitableTrades.forEach(trade => {
            const pnl = this.safeNumeric(trade.realized_pnl);
            const pnlPercentage = this.safeNumeric(trade.realized_pnl_percentage);
            totalProfits += pnl;
            totalGainPercentage += pnlPercentage;
        });

        lossTrades.forEach(trade => {
            const pnl = this.safeNumeric(trade.realized_pnl);
            const pnlPercentage = this.safeNumeric(trade.realized_pnl_percentage);
            totalLosses += pnl;
            totalLossPercentage += pnlPercentage;
        });

        const totalTrades = closedTrades.length;
        const winRate = totalTrades > 0 ? (profitableTrades.length / totalTrades) * 100 : 0;

        const avgWin = profitableTrades.length > 0
            ? profitableTrades.reduce((sum, trade) => 
                sum + this.safeNumeric(trade.realized_pnl), 0) / profitableTrades.length
            : 0;
    
        const avgLoss = lossTrades.length > 0
            ? Math.abs(lossTrades.reduce((sum, trade) => 
                sum + this.safeNumeric(trade.realized_pnl), 0) / lossTrades.length)
            : 0;
    
        const profitFactor = totalLosses !== 0 
            ? totalProfits / totalLosses
            : totalProfits > 0 ? Number.POSITIVE_INFINITY : 0;
    
        const payoffRatio = avgLoss !== 0
            ? avgWin / avgLoss
            : avgWin > 0 ? Number.POSITIVE_INFINITY : 0;
    
        const expectancy = (winRate / 100 * avgWin) - ((1 - winRate / 100) * avgLoss);
    
        const avgRRR = closedTrades.length > 0
            ? closedTrades.reduce((sum, trade) => 
                sum + this.safeNumeric(trade.risk_reward_ratio), 0) / closedTrades.length
            : 0;
    
        const avgWinR = profitableTrades.length > 0
            ? profitableTrades.reduce((sum, trade) => 
                sum + this.safeNumeric(trade.realized_pnl) / this.safeNumeric(trade.initial_risk_amount!), 0) / profitableTrades.length
            : 0;
    
        const avgLossR = lossTrades.length > 0
            ? Math.abs(lossTrades.reduce((sum, trade) => 
                sum + this.safeNumeric(trade.realized_pnl) / this.safeNumeric(trade.initial_risk_amount!), 0) / lossTrades.length)
            : 0;

        const avgGainPercentage = profitableTrades.length > 0 ? totalGainPercentage / profitableTrades.length : 0;
        const avgLossPercentage = lossTrades.length > 0 ? totalLossPercentage / lossTrades.length : 0;

        // Calculate largest win/loss
        const largestWin = profitableTrades.length > 0
            ? Math.max(...profitableTrades.map(t => this.safeNumeric(t.realized_pnl)))
            : 0;
    
        const largestLoss = lossTrades.length > 0
            ? Math.abs(Math.min(...lossTrades.map(t => this.safeNumeric(t.realized_pnl))))
            : 0;

        const streakMetrics = this.calculateStreakMetrics(trades);

        return {
            winRate,
            avgWin,
            avgLoss,
            profitFactor,
            expectancy,
            payoffRatio,
            totalTrades,
            profitableTradesCount: profitableTrades.length,
            lossTradesCount: lossTrades.length,
            breakEvenTradesCount: breakEvenTrades.length,
            totalProfits,
            totalLosses,
            largestWin,
            largestLoss,
            avgWinR,
            avgLossR,
            avgRRR,
            currentStreak: streakMetrics.currentStreak,
            longestWinStreak: streakMetrics.longestWinStreak,
            longestLossStreak: streakMetrics.longestLossStreak,
            avgGainPercentage,
            avgLossPercentage
        };
    }

    ///////// Compute using Closed Trades Only ////////
    public async fetchLatestPortfolioMetrics(userId: string, forceRefresh: boolean = false): Promise<any> {
        // Return cached data if available and not expired
        if (!forceRefresh && this.metricsCache && 
            (Date.now() - this.metricsCache.timestamp) < this.CACHE_DURATION) {
            console.log('🟢 Using cached metrics data');
            return this.metricsCache.data;
        }

        const { data, error } = await supabase
            .from('trading_metrics')
            .select('*')
            .eq('user_id', userId)
            .order('date', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            console.error('Error fetching metrics:', error);
            return null;
        }

        // Update cache
        this.metricsCache = {
            data,
            timestamp: Date.now()
        };
        console.log('🔵 Fetched fresh metrics data');

        return data;
    }

    public async calculateExposureMetrics(
        trades: Trade[], 
        currentCapital: number
    ): Promise<ExposureMetrics> {
        try {
            const activeTrades = trades.filter(trade => trade.status === TRADE_STATUS.OPEN);
            
            // 1. Daily Exposure
            const todaysTrades = activeTrades.filter(trade => 
                dayjs(trade.entry_datetime).isSame(dayjs(), 'day'));
            
            const der = todaysTrades.reduce((sum, trade) => 
                sum + (trade.initial_position_risk ?? 0), 0);
            
            const dep = todaysTrades.reduce((sum, trade) => {
                const unrealizedPnL = trade.unrealized_pnl ?? 0;
                return sum + (unrealizedPnL / currentCapital * 100);
            }, 0);
    
            // 2. New Exposure (Past Week)
            const recentTrades = activeTrades.filter(trade => 
                dayjs(trade.entry_datetime).isAfter(dayjs().subtract(7, 'days')));
            
            const ner = recentTrades.reduce((sum, trade) => 
                sum + (trade.initial_position_risk ?? 0), 0);
            
            const nep = recentTrades.reduce((sum, trade) => {
                const unrealizedPnL = trade.unrealized_pnl ?? 0;
                return sum + (unrealizedPnL / currentCapital * 100);
            }, 0);
    
            // 3. Open Exposure
            const oer = activeTrades.reduce((sum, trade) => 
                sum + (trade.initial_position_risk ?? 0), 0);
            
            const oep = activeTrades.reduce((sum, trade) => {
                const totalPnL = (trade.unrealized_pnl ?? 0) + (trade.realized_pnl ?? 0);
                return sum + (totalPnL / currentCapital * 100);
            }, 0);
    
            // Delta calculations
            const deltaDE = dep - der;
            const deltaNE = nep - ner;
            const deltaOE = oep - oer;
    
            return {
                der,
                dep,
                deltaDE,
                ner,
                nep,
                deltaNE,
                oer,
                oep,
                deltaOE
            };
        } catch (error) {
            console.error('Error calculating exposure metrics:', error);
            throw error;
        }
    }

    ///////// Compute using Closed Trades Only ////////
    public async calculatePortfolioMetrics(
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

            // 4. Calculate actual metrics
            const performanceMetrics = this.calculateTradePerformanceMetrics(validatedTrades);

            const exposureMetrics = await this.calculateExposureMetrics(
                validatedTrades, 
                currentCapital
            );
    
            return {
                startingCapital: actualStartingCapital,
                currentCapital,
                performanceMetrics,
                exposureMetrics,
                streakMetrics: this.calculateStreakMetrics(validatedTrades)
        };
        } catch (error) {
            log('error', 'Portfolio metrics calculation failed', { error });
            throw error;
        }
    }

    private async getTradesForDate(userId: string, date: string): Promise<Trade[]> {
        try {
            const endOfDay = dayjs(date).endOf('day').toISOString();

            // Get all trades up to this date
            const { data: trades, error } = await supabase
                .from('trades')
                .select('*')
                .eq('user_id', userId)
                .lte('created_at', endOfDay)
                .order('created_at', { ascending: true });

            if (error) throw error;
            return trades || [];
        } catch (error) {
            console.error('Error fetching trades for date:', error);
            throw error;
        }
    }

    public async updateDailyMetrics(userId: string, date: string): Promise<void> {
        try {
            // Get all trades up to this date for cumulative metrics
            const trades = await this.getTradesForDate(userId, date);
            const performanceMetrics = this.calculateTradePerformanceMetrics(trades);

            // Get today's trades for checking if we need to carry forward
            const todaysTrades = trades.filter(trade => 
                dayjs(trade.created_at).isSame(dayjs(date), 'day')
            );

            // Fetch the previous day's metrics
            const { data: previousMetrics, error: prevError } = await supabase
                .from('trading_metrics')
                .select('*')
                .eq('user_id', userId)
                .lt('date', date)
                .order('date', { ascending: false })
                .limit(1);

            if (prevError) {
                console.error('Error fetching previous metrics:', prevError);
            }

            const previousMetricsData = previousMetrics?.[0];

            // If no trades today, carry forward previous metrics
            const tradeMetrics = todaysTrades.length === 0 && previousMetricsData ? {
                win_rate: previousMetricsData.win_rate,
                avg_win: previousMetricsData.avg_win,
                avg_loss: previousMetricsData.avg_loss,
                profit_factor: previousMetricsData.profit_factor,
                avg_rrr: previousMetricsData.avg_rrr,
                avg_r_win: previousMetricsData.avg_r_win,
                avg_r_loss: previousMetricsData.avg_r_loss,
                total_profits: previousMetricsData.total_profits,
                total_losses: previousMetricsData.total_losses,
                expectancy: previousMetricsData.expectancy,
                payoff_ratio: previousMetricsData.payoff_ratio,
                total_trades: previousMetricsData.total_trades,
                profitable_trades_count: previousMetricsData.profitable_trades_count,
                loss_trades_count: previousMetricsData.loss_trades_count,
                break_even_trades_count: previousMetricsData.break_even_trades_count,
                largest_win: previousMetricsData.largest_win,
                largest_loss: previousMetricsData.largest_loss
            } : {
                win_rate: performanceMetrics.winRate,
                avg_win: performanceMetrics.avgWin,
                avg_loss: performanceMetrics.avgLoss,
                profit_factor: performanceMetrics.profitFactor,
                expectancy: performanceMetrics.expectancy,
                payoff_ratio: performanceMetrics.payoffRatio,
                total_trades: performanceMetrics.totalTrades,
                profitable_trades_count: performanceMetrics.profitableTradesCount,
                loss_trades_count: performanceMetrics.lossTradesCount,
                break_even_trades_count: performanceMetrics.breakEvenTradesCount,
                total_profits: performanceMetrics.totalProfits,
                total_losses: performanceMetrics.totalLosses,
                largest_win: performanceMetrics.largestWin,
                largest_loss: performanceMetrics.largestLoss,
                avg_win_r: performanceMetrics.avgWinR,
                avg_loss_r: performanceMetrics.avgLossR,
                avg_rrr: performanceMetrics.avgRRR
            };

            const { error } = await supabase
                .from('trading_metrics')
                .upsert({
                    user_id: userId,
                    date,
                    ...tradeMetrics,
                    updated_at: new Date().toISOString()
                },
                {
                    onConflict: 'user_id,date'
                });

            if (error) throw error;
        } catch (error) {
            console.error('Error updating daily metrics:', error);
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

    async updateTradesWithDetailedMetrics(quotes: Record<string, Quote>, trades: Trade[]): Promise<Trade[]> {
        log('info', 'Updating trades with detailed metrics');
    
        // Get starting capital
        const startingCapital = await this.retrieveStartingCapital();

        // Calculate current capital to get total capital for metrics
        const currentCapital = await capitalService.calculateCurrentCapital();

        // Process trades with detailed metrics
        const updatedTrades = await Promise.all(trades.map(async (trade) => {
            // Calculate trade-specific metrics
            const tradeMetrics = await this.calculateTradeMetrics(
                trade, 
                quotes,
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
                current_risk_amount: tradeMetrics.current_risk_amount,
                initial_position_risk: tradeMetrics.initial_position_risk,
                current_var: tradeMetrics.current_var,
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

    async fetchHistoricalExposureMetrics(userId: string, days: number = 21): Promise<any[]> {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const { data, error } = await supabase
            .from('trading_metrics')
            .select('date, der, dep, delta_de, ner, nep, delta_ne, oer, oep, delta_oe')
            .eq('user_id', userId)
            .gte('date', startDate.toISOString().split('T')[0])
            .lte('date', endDate.toISOString().split('T')[0])
            .order('date', { ascending: true });

        if (error) throw error;
        return data || [];
    }

    public async upsertExposureMetrics(
        userId: string,
        exposureMetrics: ExposureMetrics
    ): Promise<void> {
        const today = new Date().toISOString().split('T')[0];  // YYYY-MM-DD
    
        const { error } = await supabase
            .from('trading_metrics')  // New table for exposure metrics
            .upsert({
                user_id: userId,
                date: today,
                // Exposure Metrics only
                der: exposureMetrics.der,
                dep: exposureMetrics.dep,
                delta_de: exposureMetrics.deltaDE,
                ner: exposureMetrics.ner,
                nep: exposureMetrics.nep,
                delta_ne: exposureMetrics.deltaNE,
                oer: exposureMetrics.oer,
                oep: exposureMetrics.oep,
                delta_oe: exposureMetrics.deltaOE,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id,date'
            })
            .select();
    
        if (error) throw error;
    }
    
    // Keep the original for performance metrics
    public async upsertPerformanceMetrics(
        userId: string,
        performanceMetrics: PerformanceMetrics
    ): Promise<void> {
        const today = new Date().toISOString().split('T')[0];
    
        console.log(`Upserting performance metrics for user ${userId} on ${today}:`, performanceMetrics);
    
        const { error } = await supabase
            .from('trading_metrics')
            .upsert(
                {
                    user_id: userId,
                    date: today,
                    // Performance Metrics
                    win_rate: performanceMetrics.winRate,
                    avg_win: performanceMetrics.avgWin,
                    avg_loss: performanceMetrics.avgLoss,
                    profit_factor: performanceMetrics.profitFactor,
                    expectancy: performanceMetrics.expectancy,
                    payoff_ratio: performanceMetrics.payoffRatio,
                    total_trades: performanceMetrics.totalTrades,
                    profitable_trades_count: performanceMetrics.profitableTradesCount,
                    loss_trades_count: performanceMetrics.lossTradesCount,
                    break_even_trades_count: performanceMetrics.breakEvenTradesCount,
                    total_profits: performanceMetrics.totalProfits,
                    total_losses: performanceMetrics.totalLosses,
                    largest_win: performanceMetrics.largestWin,
                    largest_loss: performanceMetrics.largestLoss,
                    avg_r_win: performanceMetrics.avgWinR,
                    avg_r_loss: performanceMetrics.avgLossR,
                    avg_rrr: performanceMetrics.avgRRR,
                    // Streak Metrics
                    current_streak: performanceMetrics.currentStreak,
                    longest_win_streak: performanceMetrics.longestWinStreak,
                    longest_loss_streak: performanceMetrics.longestLossStreak,
                    avg_gain_percentage: performanceMetrics.avgGainPercentage,
                    avg_loss_percentage: performanceMetrics.avgLossPercentage,
                    updated_at: new Date().toISOString()
                },
                {
                    onConflict: 'user_id,date',
                    ignoreDuplicates: false
                }
            )
            .select();
    
        if (error) {
            console.error(`Error upserting performance metrics for user ${userId}:`, error);
            throw error;
        }
    
        console.log(`Successfully upserted performance metrics for user ${userId} on ${today}`);
    }

    // Add method to invalidate cache when metrics change
    public invalidateMetricsCache(): void {
        this.metricsCache = null;
        console.log('🔴 Metrics cache invalidated');
    }

    // // Add this function to fetch historical trades
    // async fetchHistoricalTrades(userId: string, start?: Date, end?: Date) {
    //     try {
    //         const queryParams = new URLSearchParams();
    //         if (start) queryParams.append('start', start.toISOString());
    //         if (end) queryParams.append('end', end.toISOString());
            
    //         const response = await axios.get(`${API_URL}/trades/historical/${userId}?${queryParams}`);
    //         return response.data;
    //     } catch (error) {
    //         console.error('Error fetching historical trades:', error);
    //         return [];
    //     }
    // }
}

// Export an instance of the service
export const metricsService = new MetricsService();

// Export the method directly for easier import
export const calculatePortfolioMetrics = (
    trades: Trade[] | null = null, 
    startingCapital: number | null = null
) => metricsService.calculatePortfolioMetrics(trades, startingCapital);

export const fetchLatestPortfolioMetrics = metricsService.fetchLatestPortfolioMetrics.bind(metricsService);