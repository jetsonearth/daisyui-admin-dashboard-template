import { supabase } from '../config/supabaseClient';
import { userSettingsService } from './userSettingsService';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

// Define interfaces for type safety
interface CapitalChangeMetadata {
    timestamp?: string;
    starting_cash?: number;
    new_capital?: number;
    trades_count?: number;
    trade_details?: Array<{
        ticker: string;
        unrealized_pnl: number;
    }>;
    type?: 'end_of_day_snapshot' | 'interim_snapshot' | 'manual_update';
    manual_update?: boolean;
    [key: string]: any;  // Allow additional dynamic properties
}

interface CapitalChangeData {
    user_id: string;
    capital_amount: number;
    date: string;
    created_at: string;
    is_end_of_day?: boolean;
    metadata?: CapitalChangeMetadata;
}

interface CapitalSnapshotOptions {
    startDate?: string;
    endDate?: string;
    interval?: 'daily' | 'weekly' | 'monthly';
}

interface Trade {
    ticker: string;
    unrealized_pnl?: number;
    realized_pnl?: number;
}

interface EquityCurveEntry {
    date: string;
    capital_amount: number;
    is_end_of_day?: boolean;
}


export const capitalService = {
    // Record a capital change
    async recordCapitalChange(amount: number, metadata: CapitalChangeMetadata = {}): Promise<any> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No authenticated user');

            const nyTime = dayjs().tz('America/New_York');

            // Get current settings
            const currentSettings = await userSettingsService.getUserSettings();
            const startingCash = currentSettings.starting_cash || 0;
            const newCapital = startingCash + amount;

            // Prepare insert data
            const insertData: CapitalChangeData = {
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
                .upsert([insertData], {
                    onConflict: 'user_id,date'
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
    async debugCapitalRecording(amount: number, metadata: CapitalChangeMetadata = {}): Promise<any[]> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No authenticated user');

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

            return existingRecords || [];
        } catch (error) {
            console.error('Debug Error:', error);
            throw error;
        }
    },

    // Track capital changes based on trades
    async trackCapitalChange(trades: Trade[]): Promise<number> {
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
                    unrealized_pnl: trade.unrealized_pnl || 0
                }))
            });

            return currentCapital;
        } catch (error) {
            console.error('Error tracking capital change:', error);
            throw error;
        }
    },

    // Get current capital from capital_changes
    async getCurrentCapital(): Promise<number> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No authenticated user');

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
    async recordDailyCapital(
        capital: number, 
        metadata: CapitalChangeMetadata = {}, 
        isEndOfDay: boolean = true
    ): Promise<any> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No authenticated user');

            const nyTime = dayjs().tz('America/New_York');
            
            // Prepare insert data
            const insertData: CapitalChangeData = {
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
    async updateCurrentCapital(amount: number): Promise<any> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No authenticated user');

            const nyTime = dayjs().tz('America/New_York');

            // Update user settings with new starting cash
            const updatedSettings = await userSettingsService.updateUserSettings({
                starting_cash: amount
            });

            // Record the capital change
            const recordedChange = await this.recordCapitalChange(amount, {
                type: 'interim_snapshot' as const,  // Use a valid type
                timestamp: nyTime.toISOString(),
                manual_update: true  // Add additional metadata if needed
            });

            return {
                settings: updatedSettings,
                capitalChange: recordedChange
            };
        } catch (error) {
            console.error('Error updating current capital:', error);
            throw error;
        }
    },

    // Calculate cumulative capital changes for equity curve
    async calculateEquityCurve(options: CapitalSnapshotOptions = {}): Promise<any[]> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No authenticated user');

            const { 
                startDate = dayjs().subtract(1, 'month').format('YYYY-MM-DD'), 
                endDate = dayjs().format('YYYY-MM-DD'),
                interval = 'daily'
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
    }
};