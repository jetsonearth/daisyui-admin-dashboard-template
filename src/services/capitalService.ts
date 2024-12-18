import { supabase } from '../config/supabaseClient';
import { userSettingsService } from './userSettingsService';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { TRADE_STATUS } from '../features/trades/tradeModel';

dayjs.extend(utc);
dayjs.extend(timezone);

// Define interfaces for type safety
interface CapitalChangeMetadata {
    // Existing fields
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

    // New fields for tracking intraday movements
    day_high?: number;
    day_low?: number;
    last_update?: string;
    first_update_time?: string;
    final_update_time?: string;
    is_final?: boolean;

    // Keep this to allow for future additions
    [key: string]: any;
}

// You might also want to update the CapitalChangeData interface if you're using it
interface CapitalChangeData {
    user_id: string;
    capital_amount: number;
    date: string;
    created_at: string;
    updated_at: string;  // New field
    is_end_of_day: boolean;
    metadata: string;    // This will be stringified CapitalChangeMetadata
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
    recordCapitalChange: async (amount: number, metadata: CapitalChangeMetadata = {}): Promise<any> => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No authenticated user');
    
            const nyTime = dayjs().tz('America/New_York');
            const isEndOfDay = metadata.type === 'end_of_day_snapshot';
            const date = nyTime.format('YYYY-MM-DD');
    
            // Check if a record already exists for this day
            const { data: existingRecord, error: checkError } = await supabase
                .from('capital_changes')
                .select('*')
                .eq('user_id', user.id)
                .eq('date', date)
                .single();
    
            if (checkError && checkError.code !== 'PGRST116') {
                // PGRST116 means no rows found, which is okay
                throw checkError;
            }
    
            // Prepare metadata with high/low tracking
            const newMetadata = {
                ...metadata,
                timestamp: nyTime.toISOString(),
                last_update: nyTime.toISOString()
            };
    
            if (existingRecord) {
                const existingMetadata = JSON.parse(existingRecord.metadata);
                
                // Update high/low while preserving existing metadata
                newMetadata.day_high = Math.max(amount, existingMetadata.day_high || amount);
                newMetadata.day_low = Math.min(amount, existingMetadata.day_low || amount);
                
                // If this is end of day, mark it
                if (isEndOfDay) {
                    newMetadata.is_final = true;
                    newMetadata.final_update_time = nyTime.toISOString();
                }
            } else {
                // New record for the day
                newMetadata.day_high = amount;
                newMetadata.day_low = amount;
                newMetadata.first_update_time = nyTime.toISOString();
            }
    
            const capitalChangeData = {
                user_id: user.id,
                capital_amount: amount,
                date: date,
                created_at: existingRecord ? existingRecord.created_at : nyTime.toISOString(),
                updated_at: nyTime.toISOString(),
                is_end_of_day: isEndOfDay,
                metadata: JSON.stringify(newMetadata)
            };
    
            if (existingRecord) {
                // Update existing record
                const { data, error } = await supabase
                    .from('capital_changes')
                    .update(capitalChangeData)
                    .eq('id', existingRecord.id)
                    .select();
    
                if (error) {
                    console.error('Error updating capital change:', error);
                    throw error;
                }
    
                return data;
            } else {
                // Insert new record
                const { data, error } = await supabase
                    .from('capital_changes')
                    .insert(capitalChangeData)
                    .select();
    
                if (error) {
                    console.error('Error inserting capital change:', error);
                    throw error;
                }
    
                return data;
            }
        } catch (error) {
            console.error('Error recording capital change:', error);
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
            await this.recordCapitalChange(eodCapital, {
                type: 'end_of_day_snapshot',
                is_end_of_day: true,
                trades_count: trades.length,
                open_trades: trades.filter(t => t.status === TRADE_STATUS.OPEN).length,
                eod_metrics: {
                    realized_pnl: totalRealizedPnL,
                    unrealized_pnl: totalUnrealizedPnL,
                    starting_capital: startingCapital
                },
                snapshot_time: dayjs().tz('America/New_York').format()
            });
    
        } catch (error) {
            console.error('Error recording end of day snapshot:', error);
            throw error;
        }
    },

    // Debug method to inspect capital recording
    // async debugCapitalRecording(amount: number, metadata: CapitalChangeMetadata = {}): Promise<any[]> {
    //     try {
    //         const { data: { user } } = await supabase.auth.getUser();
    //         if (!user) throw new Error('No authenticated user');

    //         const nyTime = dayjs().tz('America/New_York');

    //         console.log('🕵️ Capital Recording Debug:', {
    //             user_id: user.id,
    //             amount,
    //             date: nyTime.format('YYYY-MM-DD'),
    //             metadata,
    //             current_timestamp: nyTime.toISOString()
    //         });

    //         // Attempt to find existing records
    //         const { data: existingRecords, error: fetchError } = await supabase
    //             .from('capital_changes')
    //             .select('*')
    //             .eq('user_id', user.id)
    //             .eq('date', nyTime.format('YYYY-MM-DD'));

    //         if (fetchError) {
    //             console.error('Error fetching existing records:', fetchError);
    //         }

    //         console.log('🔍 Existing Records:', existingRecords);

    //         return existingRecords || [];
    //     } catch (error) {
    //         console.error('Debug Error:', error);
    //         throw error;
    //     }
    // },

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

    // Update current capital directly
    async updateCurrentCapital(
        amount: number, 
        metadata: CapitalChangeMetadata = {}
    ): Promise<any> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No authenticated user');
    
            const nyTime = dayjs().tz('America/New_York');
    
            const updatedSettings = await userSettingsService.updateUserSettings({
                current_capital: amount
            });
    
            // Record the capital change
            const recordedChange = await this.recordCapitalChange(amount, {
                type: 'interim_snapshot' as const,
                timestamp: nyTime.toISOString(),
                ...metadata  // Spread additional metadata
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