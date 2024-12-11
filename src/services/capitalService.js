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
            const nyTime = dayjs().tz('America/New_York');

            // Get current settings
            const currentSettings = await userSettingsService.getUserSettings();
            const startingCash = currentSettings.starting_cash || 0;
            const newCapital = startingCash + amount;

            // Prepare insert data
            const insertData = {
                user_id: user.id,
                capital_amount: amount,
                date: nyTime.format('YYYY-MM-DD'),
                created_at: nyTime.toISOString(),
                metadata: {
                    ...metadata,
                    timestamp: nyTime.toISOString(),
                    starting_cash: startingCash,
                    new_capital: newCapital
                }
            };

            // Upsert the record
            const { data, error } = await supabase
                .from('capital_changes')
                .upsert(insertData, {
                    onConflict: {
                        constraint: 'capital_changes_user_id_date_key',
                        update: {
                            capital_amount: insertData.capital_amount,
                            metadata: insertData.metadata
                        }
                    },
                    returning: 'minimal'
                });

            if (error) {
                console.error('Capital change error:', error);
                throw error;
            }

            // Update user settings
            await userSettingsService.updateUserSettings({
                starting_cash: newCapital
            });

            return data;
        } catch (error) {
            console.error('Error recording capital change:', error);
            throw error;
        }
    },

    // Debug method to inspect capital recording
    async debugCapitalRecording(amount, metadata = {}) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const nyTime = dayjs().tz('America/New_York');

            console.log('🕵️ Capital Recording Debug:', {
                user_id: user.id,
                amount,
                date: nyTime.format('YYYY-MM-DD'),
                metadata,
                current_timestamp: nyTime.toISOString()
            });

            // Attempt to find existing records
            const { data: existingRecords, error: fetchError } = await supabase
                .from('capital_changes')
                .select('*')
                .eq('user_id', user.id)
                .eq('date', nyTime.format('YYYY-MM-DD'));

            if (fetchError) {
                console.error('Error fetching existing records:', fetchError);
            }

            console.log('🔍 Existing Records:', existingRecords);

            return existingRecords;
        } catch (error) {
            console.error('Debug Error:', error);
            throw error;
        }
    },

    // Track capital changes based on trades
    async trackCapitalChange(trades) {
        try {
            // Calculate total PnL
            const totalUnrealizedPnL = trades.reduce((sum, trade) => 
                sum + (trade.unrealized_pnl || 0), 0);
            const totalRealizedPnL = trades.reduce((sum, trade) => 
                sum + (trade.realized_pnl || 0), 0);

            // Get current settings
            const settings = await userSettingsService.getUserSettings();
            const startingCash = settings.starting_cash || 0;

            // Calculate current capital
            const currentCapital = startingCash + totalUnrealizedPnL + totalRealizedPnL;

            // Record capital change
            await this.recordCapitalChange(currentCapital, {
                trades_count: trades.length,
                trade_details: trades.map(trade => ({
                    ticker: trade.ticker,
                    unrealized_pnl: trade.unrealized_pnl
                }))
            });

            return currentCapital;
        } catch (error) {
            console.error('Error tracking capital change:', error);
            throw error;
        }
    },

    // Get current capital from capital_changes
    async getCurrentCapital() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const nyTime = dayjs().tz('America/New_York');

            // Get the most recent capital entry
            const { data, error } = await supabase
                .from('capital_changes')
                .select('capital_amount')
                .eq('user_id', user.id)
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

    // Record daily capital snapshot
    async recordDailyCapital(capital, metadata = {}, isEndOfDay = true) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const nyTime = dayjs().tz('America/New_York');
            
            // Prepare insert data
            const insertData = {
                user_id: user.id,
                capital_amount: capital,
                date: nyTime.format('YYYY-MM-DD'),
                created_at: nyTime.toISOString(),
                is_end_of_day: isEndOfDay,
                metadata: {
                    ...metadata,
                    type: isEndOfDay ? 'end_of_day_snapshot' : 'interim_snapshot',
                    timestamp: nyTime.toISOString()
                }
            };

            // Upsert the record with explicit conflict resolution
            const { data, error } = await supabase
                .from('capital_changes')
                .upsert(insertData, {
                    onConflict: 'user_id,date,is_end_of_day'
                });

            if (error) {
                console.error('Daily capital record error:', error);
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Error recording daily capital:', error);
            throw error;
        }
    },

    // Update current capital directly
    async updateCurrentCapital(capital, metadata = {}) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const nyTime = dayjs().tz('America/New_York');
            
            // Get current user settings to preserve starting cash
            const currentSettings = await userSettingsService.getUserSettings();
            const startingCash = currentSettings.starting_cash;

            // Calculate current capital (total change from starting cash)
            const currentCapital = capital;

            // Update user settings - only update current_capital, keep starting_cash unchanged
            await userSettingsService.updateUserSettings({
                current_capital: currentCapital
            });

            // Prepare insert data for capital_changes
            const insertData = {
                user_id: user.id,
                capital_amount: capital,  // Total current capital
                date: nyTime.format('YYYY-MM-DD'),
                created_at: nyTime.toISOString(),
                is_end_of_day: false,
                metadata: {
                    ...metadata,
                    type: 'current_capital_update',
                    timestamp: nyTime.toISOString(),
                    starting_cash: startingCash,
                    current_capital: currentCapital
                }
            };

            // Upsert the record in capital_changes
            const { data, error } = await supabase
                .from('capital_changes')
                .upsert(insertData, {
                    onConflict: 'user_id,date,is_end_of_day'
                });

            if (error) {
                console.error('Current capital update error:', error);
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Error updating current capital:', error);
            throw error;
        }
    },

    // Calculate cumulative capital changes for equity curve
    async calculateEquityCurve(options = {}) {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            // Fetch capital change history
            const { data: capitalHistory, error } = await supabase
                .from('capital_changes')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at');

            if (error) throw error;

            // Calculate cumulative capital
            let cumulativeCapital = 0;
            const equityCurve = capitalHistory.map(change => {
                cumulativeCapital += change.capital_amount;
                return {
                    timestamp: change.created_at,
                    amount: cumulativeCapital,
                    metadata: change.metadata
                };
            });

            return equityCurve;
        } catch (error) {
            console.error('Error calculating equity curve:', error);
            throw error;
        }
    }
};