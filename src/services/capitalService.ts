import { supabase } from '../config/supabaseClient';
import { userSettingsService } from './userSettingsService';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { TRADE_STATUS } from '../types';
import { marketDataService } from '../features/marketData/marketDataService';
import { CapitalSnapshot, DrawdownPeriod, EquityPoint, CapitalMetrics, DailyCapitalStats } from '../types/capital';

dayjs.extend(utc);
dayjs.extend(timezone);

// Define interfaces for type safety
interface CapitalChangeMetadata {
    trade_details?: Array<{
        ticker: string;
        unrealized_pnl: number;
    }>;
}

// You might also want to update the CapitalChangeData interface if you're using it
interface CapitalChangeData {
    user_id: string;
    capital_amount: number;
    date: string;
    created_at: string;
    updated_at: string;
    metadata: string;    // This will be stringified CapitalChangeMetadata
    day_high: number;
    day_low: number;
    high_watermark: number;
    current_drawdown: number;
    max_drawdown: number;
    realized_pnl: number;
    unrealized_pnl: number;
    cumulative_pnl: number;
}

interface CapitalSnapshotOptions {
    startDate?: string;
    endDate?: string;
    interval?: 'daily' | 'weekly' | 'monthly';
    includeIntraday?: boolean;
}

interface Trade {
    ticker: string;
    unrealized_pnl?: number;
    realized_pnl?: number;
    entry_datetime?: string;
    exit_datetime?: string;
    status?: string;
}

interface EquityCurveEntry {
    date: string;
    capital_amount: number;
    is_end_of_day?: boolean;
    high_watermark?: number;
    drawdown?: number;
    runup?: number;
}

interface TradeData {
    status: string;
    realized_pnl?: number;
    unrealized_pnl?: number;
    exit_datetime?: string;
    entry_datetime?: string;
}

export const capitalService = {
    // Record a capital change
    recordCapitalChange: async (amount: number, metadata: CapitalChangeMetadata = {}, recordDate?: string): Promise<any> => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No authenticated user');
    
            const date = recordDate || dayjs().format('YYYY-MM-DD');
            const timestamp = new Date().toISOString();
            
            console.log('Recording capital change:', {
                amount,
                date,
                userId: user.id
            });
    
            // Get any existing changes for this day to update high/low
            const { data: sameDayChanges, error: historyError } = await supabase
                .from('capital_changes')
                .select('*')
                .eq('user_id', user.id)
                .eq('date', date);

            if (historyError) {
                console.error('Error fetching same day changes:', historyError);
                throw historyError;
            }

            // Calculate day high/low
            let dayHigh = amount;
            let dayLow = amount;

            if (sameDayChanges?.length > 0) {
                dayHigh = Math.max(amount, ...sameDayChanges.map(c => c.day_high || c.capital_amount));
                dayLow = Math.min(amount, ...sameDayChanges.map(c => c.day_low || c.capital_amount));
            }
    
            const capitalChangeData = {
                user_id: user.id,
                capital_amount: amount,
                date,
                created_at: timestamp,
                updated_at: timestamp,
                day_high: dayHigh,
                day_low: dayLow,
                unrealized_pnl: 0
            };
    
            console.log('Preparing to save capital change:', capitalChangeData);
    
            // Use upsert to handle both insert and update cases
            const { data, error } = await supabase
                .from('capital_changes')
                .upsert(capitalChangeData, {
                    onConflict: 'user_id,date',
                    ignoreDuplicates: false
                })
                .select();

            if (error) {
                console.error('Error upserting capital change:', error);
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Error in recordCapitalChange:', error);
            throw error;
        }
    },

    // Add to capitalService
    async recordEndOfDaySnapshot(): Promise<void> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No authenticated user');
    
            // Get all trades
            const { data: trades } = await supabase
                .from('trades')
                .select('*')
                .eq('user_id', user.id);
    
            // Check if trades is null or an empty array
            if (!trades || trades.length === 0) {
                console.warn('No trades found for the user.');
                return; // or handle the case as needed
            }
    
            // Get settings for starting capital
            const settings = await userSettingsService.getUserSettings();
            const startingCapital = settings.starting_cash || 0;
    
            // Calculate final EOD values
            const totalRealizedPnL = trades.reduce((sum, trade) => 
                sum + (trade.realized_pnl || 0), 0);
            const totalUnrealizedPnL = trades.reduce((sum, trade) => 
                sum + (trade.unrealized_pnl || 0), 0);
            const eodCapital = startingCapital + totalRealizedPnL + totalUnrealizedPnL;
    
            // Record EOD snapshot with detailed metadata
            await this.recordCapitalChange(eodCapital, {}, dayjs().format('YYYY-MM-DD'));
    
        } catch (error) {
            console.error('Error recording end of day snapshot:', error);
            throw error;
        }
    },

    // Track capital changes based on trades
    async trackCapitalChange(trades: Trade[]): Promise<number> {
        try {
            // Use calculateCurrentCapital instead of recalculating
            const currentCapital = await this.calculateCurrentCapital();
            
            // Record the change (this is still valuable for tracking)
            await this.recordCapitalChange(currentCapital, {}, dayjs().format('YYYY-MM-DD'));
    
            return currentCapital;
        } catch (error) {
            console.error('Error tracking capital change:', error);
            throw error;
        }
    },

    // Get current capital from capital_changes
    // Quick retrieval of last known capital
    async getCurrentCapital(): Promise<number> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No authenticated user');
    
            const { data, error } = await supabase
                .from('capital_changes')
                .select('capital_amount')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1);
    
            if (error) throw error;
    
            // If no record exists, do a full calculation
            if (!data || data.length === 0) {
                return this.calculateCurrentCapital();
            }
    
            return data[0].capital_amount;
        } catch (error) {
            console.error('Error getting current capital:', error);
            throw error;
        }
    },
    
    // Full recalculation with latest market data
    async calculateCurrentCapital(existingQuotes?: Record<string, any>): Promise<number> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            
            if (!user) {
                throw new Error('User not authenticated');
            }

            // Get all trades
            const { data: trades, error: tradesError } = await supabase
                .from('trades')
                .select('*')
                .eq('user_id', user.id);

            if (tradesError) {
                throw tradesError;
            }

            // Get starting capital
            const startingCapital = await this.retrieveStartingCapital();

            // Get current market data for active trades
            const activeTrades = trades.filter(trade => trade.status === TRADE_STATUS.OPEN);
            const closedTrades = trades.filter(trade => trade.status === TRADE_STATUS.CLOSED);
            
            // Calculate realized PnL from closed trades
            const realizedPnL = closedTrades.reduce((sum, trade) => sum + (trade.realized_pnl || 0), 0);
            
            if (activeTrades.length === 0) {
                return startingCapital + realizedPnL;
            }

            try {
                // Use existing quotes if provided, otherwise fetch new ones
                const quotes = existingQuotes || await marketDataService.getBatchQuotes(activeTrades.map(trade => trade.ticker));
                
                // Calculate unrealized PnL from active trades
                const unrealizedPnL = activeTrades.reduce((sum, trade) => {
                    const quote = quotes[trade.ticker];
                    if (!quote) {
                        console.warn(`No market data available for ${trade.ticker}`);
                        return sum + (trade.unrealized_pnl || 0); // Use last known unrealized PnL as fallback
                    }

                    const unrealizedPnL = (quote.price - trade.entry_price) * trade.remaining_shares;
                    return sum + unrealizedPnL;
                }, 0);

                // Add up starting capital + realized PnL from closed trades + unrealized PnL from active trades
                return startingCapital + realizedPnL + unrealizedPnL;
            } catch (error) {
                console.error('Error fetching market data:', error);
                // Fall back to using last known prices for active trades
                const lastKnownUnrealizedPnL = activeTrades.reduce((sum, trade) => 
                    sum + (trade.unrealized_pnl || 0), 0);
                return startingCapital + realizedPnL + lastKnownUnrealizedPnL;
            }
        } catch (error) {
            console.error('Error calculating current capital:', error);
            throw error;
        }
    },
    
    async calculateDrawdownMetrics(userId: string): Promise<{
        currentDrawdown: number;
        maxDrawdown: number;
        drawdownPeriods: DrawdownPeriod[];
    }> {
        try {
            let currentDrawdownPeriod: DrawdownPeriod | null = null;
            const drawdownPeriods: DrawdownPeriod[] = [];

            // Get capital snapshots
            const { data: snapshots } = await supabase
                .from('capital_changes')
                .select('*')
                .eq('user_id', userId)
                .order('date', { ascending: true });

            if (!snapshots?.length) {
                return { currentDrawdown: 0, maxDrawdown: 0, drawdownPeriods: [] };
            }

            let highWatermark = snapshots[0].capital_amount;
            let maxDrawdown = 0;
            let currentDrawdown = 0;

            snapshots.forEach((snapshot, index) => {
                const capital = snapshot.capital_amount;
                
                if (capital > highWatermark) {
                    highWatermark = capital;
                    if (currentDrawdownPeriod) {
                        currentDrawdownPeriod.end_date = new Date(snapshot.date);
                        currentDrawdownPeriod.recovery_capital = capital;
                        currentDrawdownPeriod.recovered = true;
                        drawdownPeriods.push(currentDrawdownPeriod);
                        currentDrawdownPeriod = null;
                    }
                } else if (capital < highWatermark) {
                    const drawdownPercent = ((highWatermark - capital) / highWatermark) * 100;
                    
                    if (!currentDrawdownPeriod) {
                        currentDrawdownPeriod = {
                            start_date: new Date(snapshot.date),
                            end_date: undefined,
                            start_capital: highWatermark,
                            lowest_capital: capital,
                            recovery_capital: undefined,
                            drawdown_percentage: drawdownPercent,
                            recovered: false
                        };
                    } else if (capital < currentDrawdownPeriod.lowest_capital) {
                        currentDrawdownPeriod.lowest_capital = capital;
                        currentDrawdownPeriod.drawdown_percentage = drawdownPercent;
                    }

                    currentDrawdown = drawdownPercent;
                    maxDrawdown = Math.max(maxDrawdown, drawdownPercent);
                }
            });

            // Add any unrecovered drawdown period
            if (currentDrawdownPeriod) {
                drawdownPeriods.push(currentDrawdownPeriod);
            }

            return { currentDrawdown, maxDrawdown, drawdownPeriods };
        } catch (error) {
            console.error('Error calculating drawdown metrics:', error);
            throw error;
        }
    },

    async getDetailedCapitalMetrics(userId: string): Promise<CapitalMetrics> {
        try {
            const startingCapital = await this.retrieveStartingCapital();
            const currentCapital = await this.calculateCurrentCapital();
            
            const { data: trades, error: tradesError } = await supabase
                .from('trades')
                .select('*')
                .eq('user_id', userId);

            if (tradesError) throw tradesError;
            
            const typedTrades = (trades || []) as TradeData[];

            // Calculate realized and unrealized P&L
            const realizedPnL = typedTrades
                .filter(t => t.status === TRADE_STATUS.CLOSED)
                .reduce((sum: number, t) => sum + (t.realized_pnl || 0), 0);

            const unrealizedPnL = typedTrades
                .filter(t => t.status === TRADE_STATUS.OPEN)
                .reduce((sum: number, t) => sum + (t.unrealized_pnl || 0), 0);

            // Get drawdown metrics
            const { currentDrawdown, maxDrawdown, drawdownPeriods } = 
                await this.calculateDrawdownMetrics(userId);

            // Calculate max runup
            const maxRunup = ((currentCapital - startingCapital) / startingCapital) * 100;

            // Get equity curve
            const equityCurve = await this.calculateDetailedEquityCurve(userId);

            return {
                current_capital: currentCapital,
                starting_capital: startingCapital,
                total_realized_pnl: realizedPnL,
                total_unrealized_pnl: unrealizedPnL,
                max_drawdown: maxDrawdown,
                max_runup: maxRunup,
                current_drawdown: currentDrawdown,
                current_runup: ((currentCapital - startingCapital) / startingCapital) * 100,
                average_drawdown: drawdownPeriods.reduce((sum, p) => sum + p.drawdown_percentage, 0) / drawdownPeriods.length,
                equity_curve: equityCurve,
                drawdown_periods: drawdownPeriods
            };
        } catch (error) {
            console.error('Error getting detailed capital metrics:', error);
            throw error;
        }
    },

    async calculateEquityCurve(options: CapitalSnapshotOptions = {}): Promise<any[]> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No authenticated user');

            const { 
                startDate = dayjs().subtract(1, 'month').format('YYYY-MM-DD'), 
                endDate = dayjs().format('YYYY-MM-DD'),
                interval = 'daily',
                includeIntraday = false
            } = options;

            const { data, error } = await supabase
                .from('capital_changes')
                .select('*')
                .eq('user_id', user.id)
                .gte('date', startDate)
                .lte('date', endDate)
                .order('date', { ascending: true });

            if (error) throw error;

            // Group and process data based on interval
            const processedData: EquityCurveEntry[] = data.reduce((acc: EquityCurveEntry[], entry) => {
                const date = dayjs(entry.date);
                const key = interval === 'daily' ? date.format('YYYY-MM-DD') :
                            interval === 'weekly' ? date.format('YYYY-[W]WW') :
                            date.format('YYYY-MM');
    
                const existingEntry = acc.find(item => item.date === key);
                if (!existingEntry) {
                    acc.push({
                        date: key,
                        capital_amount: entry.capital_amount,
                        is_end_of_day: entry.is_end_of_day
                    });
                }
                return acc;
            }, []);
    
            return processedData;
        } catch (error) {
            console.error('Error calculating equity curve:', error);
            throw error;
        }
    },
    async retrieveStartingCapital(): Promise<number> {
        const settings = await userSettingsService.getUserSettings();
        return settings.starting_cash || 0;
    },

    async calculateDetailedEquityCurve(userId: string): Promise<EquityPoint[]> {
        try {
            // Get account creation date
            const { data: userAccount, error: userError } = await supabase
                .from('users')
                .select('created_at')
                .eq('id', userId)
                .single();

            if (userError || !userAccount) {
                throw new Error('User account not found');
            }

            const accountCreationDate = dayjs(userAccount.created_at);

            // Get all closed trades ordered by date
            const { data: closedTrades } = await supabase
                .from('trades')
                .select('*')
                .eq('user_id', userId)
                .eq('status', 'Closed')
                .order('exit_datetime', { ascending: true });

            if (!closedTrades || closedTrades.length === 0) {
                return [];
            }

            const startingCapital = await this.retrieveStartingCapital();
            let equityPoints: EquityPoint[] = [];
            let runningCapital = startingCapital;
            let highWatermark = startingCapital;

            // Handle historical trades (before account creation)
            const historicalTrades = closedTrades.filter(trade => 
                dayjs(trade.exit_datetime).isBefore(accountCreationDate)
            );

            if (historicalTrades.length > 0) {
                // Create daily points between first historical trade and account creation
                const firstTradeDate = dayjs(historicalTrades[0].exit_datetime);
                let currentDate = firstTradeDate;
                let currentCapital = startingCapital;

                // Process historical trades day by day
                while (currentDate.isBefore(accountCreationDate)) {
                    // Find trades that closed on this date
                    const tradesOnThisDay = historicalTrades.filter(trade =>
                        dayjs(trade.exit_datetime).isSame(currentDate, 'day')
                    );

                    // Update capital if there were trades
                    if (tradesOnThisDay.length > 0) {
                        const dailyPnL = tradesOnThisDay.reduce((sum, trade) => 
                            sum + (trade.realized_pnl || 0), 0);
                        currentCapital += dailyPnL;
                    }

                    // Update high watermark
                    highWatermark = Math.max(highWatermark, currentCapital);

                    // Add point for this day
                    equityPoints.push({
                        date: currentDate.toDate(),
                        capital: currentCapital,
                        drawdown: ((highWatermark - currentCapital) / highWatermark) * 100,
                        runup: ((currentCapital - startingCapital) / startingCapital) * 100,
                        realized_pnl: currentCapital - startingCapital,
                        unrealized_pnl: 0
                    });

                    // Move to next day
                    currentDate = currentDate.add(1, 'day');
                }

                runningCapital = currentCapital;
            }

            // Handle trades after account creation
            const { data: capitalChanges } = await supabase
                .from('capital_changes')
                .select('*')
                .eq('user_id', userId)
                .gte('date', accountCreationDate.toISOString())
                .order('date', { ascending: true });

            if (capitalChanges && capitalChanges.length > 0) {
                const modernPoints = capitalChanges.map(snapshot => {
                    const capital = snapshot.capital_amount;
                    highWatermark = Math.max(highWatermark, capital);

                    const metadata = JSON.parse(snapshot.metadata);
                    return {
                        date: new Date(snapshot.date),
                        capital,
                        drawdown: ((highWatermark - capital) / highWatermark) * 100,
                        runup: ((capital - startingCapital) / startingCapital) * 100,
                        realized_pnl: metadata.realized_pnl || 0,
                        unrealized_pnl: metadata.unrealized_pnl || 0
                    };
                });

                equityPoints = [...equityPoints, ...modernPoints];
            }

            return equityPoints;
        } catch (error) {
            console.error('Error calculating detailed equity curve:', error);
            throw error;
        }
    },

    async getDailyCapitalStats(userId: string, date: string): Promise<DailyCapitalStats> {
        try {
            const dayStart = dayjs(date).startOf('day').toISOString();
            const dayEnd = dayjs(date).endOf('day').toISOString();

            const { data: snapshots } = await supabase
                .from('capital_changes')
                .select('*')
                .eq('user_id', userId)
                .gte('date', dayStart)
                .lte('date', dayEnd)
                .order('date', { ascending: true });

            if (!snapshots || snapshots.length === 0) {
                throw new Error('No data available for the specified date');
            }

            const capitalValues = snapshots.map(s => s.capital_amount);
            const metadata = snapshots.map(s => JSON.parse(s.metadata));

            return {
                date: new Date(date),
                open: snapshots[0].capital_amount,
                high: Math.max(...capitalValues),
                low: Math.min(...capitalValues),
                close: snapshots[snapshots.length - 1].capital_amount,
                realized_pnl: metadata.reduce((sum, m) => sum + (m.realized_pnl || 0), 0),
                unrealized_pnl: metadata[metadata.length - 1].unrealized_pnl || 0,
                trade_count: metadata.reduce((sum, m) => sum + (m.trades_count || 0), 0)
            };
        } catch (error) {
            console.error('Error getting daily capital stats:', error);
            throw error;
        }
    },

    // Process historical trades before account creation
    async processHistoricalTrades(userId: string) {
        try {
            console.log('Processing historical trades');
            
            // Get all closed trades ordered by exit date
            const { data: trades, error: tradesError } = await supabase
                .from('trades')
                .select('*')
                .eq('user_id', userId)
                .eq('status', 'Closed')
                .order('exit_datetime', { ascending: true });

            if (tradesError) {
                console.error('Error fetching historical trades:', tradesError);
                throw tradesError;
            }

            const historicalTrades = trades || [];

            console.log('Found historical trades:', historicalTrades.map(t => ({
                ticker: t.ticker,
                exitDate: t.exit_datetime,
                pnl: t.realized_pnl
            })));

            if (historicalTrades.length === 0) {
                console.log('No historical trades found');
                return;
            }

            const startingCapital = await this.retrieveStartingCapital();
            console.log('Starting capital:', startingCapital);

            let currentCapital = startingCapital;

            // Group trades by date
            const tradesByDate = historicalTrades.reduce<Record<string, any[]>>((acc, trade) => {
                const date = dayjs(trade.exit_datetime).format('YYYY-MM-DD');
                if (!acc[date]) acc[date] = [];
                acc[date].push(trade);
                return acc;
            }, {});

            console.log('Trades grouped by date:', Object.keys(tradesByDate).map(date => ({
                date,
                trades: tradesByDate[date].map(t => t.ticker)
            })));

            // Process each date in chronological order
            const dates = Object.keys(tradesByDate).sort();

            for (const date of dates) {
                const trades = tradesByDate[date];
                const dailyPnL = trades.reduce((sum, trade) => 
                    sum + (trade.realized_pnl || 0), 0);
                
                // Update capital for this day
                currentCapital += dailyPnL;

                console.log(`Processing date ${date}:`, {
                    trades: trades.map(t => t.ticker),
                    dailyPnL,
                    currentCapital
                });
                
                // Record this day's capital change
                await this.recordCapitalChange(currentCapital, {}, date);
            }

            console.log('Historical trade processing complete');
        } catch (error) {
            console.error('Error processing historical trades:', error);
            throw error;
        }
    },

    // Get interpolated equity curve for visualization
    async getInterpolatedEquityCurve(userId: string) {
        try {
            // Get actual capital change points
            const { data: changes } = await supabase
                .from('capital_changes')
                .select('*')
                .eq('user_id', userId)
                .order('date', { ascending: true });

            if (!changes?.length) return [];

            // For display purposes, interpolate points between changes
            const interpolatedPoints = [];
            for (let i = 0; i < changes.length - 1; i++) {
                const currentPoint = changes[i];
                const nextPoint = changes[i + 1];
                
                interpolatedPoints.push(currentPoint);

                // If there's a gap, add the same value for visualization
                if (dayjs(nextPoint.date).diff(dayjs(currentPoint.date), 'day') > 1) {
                    interpolatedPoints.push({
                        ...currentPoint,
                        interpolated: true,
                        date: dayjs(nextPoint.date).subtract(1, 'day').format('YYYY-MM-DD')
                    });
                }
            }
            
            // Add the last point
            interpolatedPoints.push(changes[changes.length - 1]);

            return interpolatedPoints;
        } catch (error) {
            console.error('Error getting interpolated equity curve:', error);
            throw error;
        }
    }
};