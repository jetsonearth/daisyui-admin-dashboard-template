import { supabase } from '../config/supabaseClient';
import { userSettingsService } from './userSettingsService';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export const capitalService = {
// Record a capital change
    async recordCapitalChange(amount, metadata = {}) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No authenticated user');

            // Always use New York time for market-related calculations
            const nyTime = dayjs().tz('America/New_York');
            
            // First, get current user settings to calculate new capital
            const currentSettings = await userSettingsService.getUserSettings();
            const currentCapital = currentSettings.starting_cash || 0;
            const newCapital = currentCapital + amount;

            // Determine if it's end of market day in New York
            const isEndOfDay = 
                nyTime.hour() >= 16 && // After 4 PM NY time
                nyTime.day() > 0 && nyTime.day() < 6; // Monday to Friday

            // Prepare the insert object
            const insertData = {
                user_id: user.id,
                capital_amount: amount,
                created_at: dayjs().toISOString(),
                date: nyTime.format('YYYY-MM-DD'),
                metadata: {
                    ...metadata,
                    previous_capital: currentCapital,
                    new_capital: newCapital,
                    ny_timestamp: nyTime.toISOString()
                },
                is_end_of_day: false  // Always false for regular capital changes
            };

            // Record capital change
            const { data: changeData, error: changeError } = await supabase
                .from('capital_changes')
                .insert(insertData);

            if (changeError) throw changeError;

            // Update user settings with new capital
            await userSettingsService.updateUserSettings({
                current_capital: newCapital,
                starting_cash: newCapital
            });

            return changeData;
        } catch (error) {
            console.error('Error recording capital change:', error);
            throw error;
        }
    },

    async recordDailyCapital(capitalAmount, metadata = {}) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            
            // Always use New York time for market-related calculations
            const nyTime = dayjs().tz('America/New_York');
            
            // End of day condition based on New York market close
            const isEndOfDay = 
                nyTime.hour() >= 16 && // After 4 PM NY time
                nyTime.day() > 0 && nyTime.day() < 6; // Monday to Friday

            const insertData = {
                user_id: user.id,
                capital_amount: capitalAmount,
                date: nyTime.format('YYYY-MM-DD'),
                is_end_of_day: isEndOfDay,
                created_at: dayjs().toISOString(),
                metadata: {
                    ...metadata,
                    source: 'daily_tracking',
                    ny_timestamp: nyTime.toISOString()
                }
            };

            const { data, error } = await supabase
                .from('capital_changes')
                .upsert(insertData, {
                    onConflict: 'user_id,date,is_end_of_day'
                });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error recording daily capital:', error);
            throw error;
        }
    },

    // Get current capital from capital_changes
    async getCurrentCapital() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No authenticated user');

            // Use New York time for consistency
            const nyTime = dayjs().tz('America/New_York');

            // Get the most recent capital entry
            const { data, error } = await supabase
                .from('capital_changes')
                .select('capital_amount')
                .eq('user_id', user.id)
                .eq('is_end_of_day', true)
                .order('created_at', { ascending: false })
                .limit(1);

            if (error) throw error;

            // If no capital entry exists, fall back to user settings
            if (!data || data.length === 0) {
                const settings = await userSettingsService.getUserSettings();
                return settings.starting_cash || 0;
            }

            return data[0].capital_amount;
        } catch (error) {
            console.error('Error getting current capital:', error);
            throw error;
        }
    },
    // Track capital changes during trade updates
    async trackCapitalChange(trades) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No authenticated user');

            // Use New York time for market-related calculations
            const nyTime = dayjs().tz('America/New_York');

            // Calculate total unrealized and realized PnL
            const totalUnrealizedPnL = trades.reduce((sum, trade) => 
                sum + (trade.unrealized_pnl || 0), 0);
            const totalRealizedPnL = trades.reduce((sum, trade) => 
                sum + (trade.realized_pnl || 0), 0);

            // Get current settings to get starting cash
            const settings = await userSettingsService.getUserSettings();
            const startingCash = settings.starting_cash || 0;

            // Calculate current capital
            const currentCapital = startingCash + totalUnrealizedPnL + totalRealizedPnL;

            // Determine if it's end of market day in New York
            const isEndOfDay = 
                nyTime.hour() >= 16 && // After 4 PM NY time
                nyTime.day() > 0 && nyTime.day() < 6; // Monday to Friday

            // Only record if it's end of day to avoid duplicate entries
            if (isEndOfDay) {
                try {
                    await this.recordDailyCapital(currentCapital, {
                        trades_count: trades.length,
                        trade_details: trades.map(trade => ({
                            ticker: trade.ticker,
                            unrealized_pnl: trade.unrealized_pnl
                        })),
                        ny_timestamp: nyTime.toISOString(),
                        source: 'trade_update'
                    });
                } catch (duplicateError) {
                    // If duplicate entry, log and continue
                    console.warn('Duplicate daily capital entry:', duplicateError);
                }
            }

            // Always record the capital change
            await this.recordCapitalChange(currentCapital, {
                trades_count: trades.length,
                trade_details: trades.map(trade => ({
                    ticker: trade.ticker,
                    unrealized_pnl: trade.unrealized_pnl
                })),
                ny_timestamp: nyTime.toISOString()
            });

            return currentCapital;
        } catch (error) {
            console.error('Error tracking capital change:', error);
            throw error;
        }
    },

    // Calculate cumulative capital changes for equity curve
    async calculateEquityCurve(options = {}) {
        try {
            const capitalHistory = await this.getCapitalChangeHistory(options);
            
            // Calculate cumulative capital
            let cumulativeCapital = 0;
            const equityCurve = capitalHistory.map(change => {
                cumulativeCapital += change.capital_amount;  // Changed from 'amount' to 'capital_amount'
                return {
                    timestamp: change.created_at,
                    amount: cumulativeCapital,
                    change_type: change.change_type
                };
            });

            return equityCurve;
        } catch (error) {
            console.error('Error calculating equity curve:', error);
            throw error;
        }
    }
};