// src/services/capitalService.js
import { supabase } from '../config/supabaseClient';
import { userSettingsService } from './userSettingsService';

export const capitalService = {
    // Insert a capital change record
    async recordCapitalChange(changeType, amount, metadata = {}) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No authenticated user');

            const { data, error } = await supabase
                .from('capital_changes')
                .insert({
                    user_id: user.id,
                    amount: amount,
                    change_type: changeType,
                    metadata: JSON.stringify(metadata),
                    created_at: new Date().toISOString()
                });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error recording capital change:', error);
            throw error;
        }
    },

    // Retrieve capital change history for plotting
    async getCapitalChangeHistory(options = {}) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            
            // Default to last 30 days if no date range specified
            const { 
                startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), 
                endDate = new Date().toISOString() 
            } = options;

            const { data, error } = await supabase
                .from('capital_changes')
                .select('*')
                .eq('user_id', user.id)
                .gte('created_at', startDate)
                .lte('created_at', endDate)
                .order('created_at', { ascending: true });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error retrieving capital change history:', error);
            throw error;
        }
    },

    // Method to track capital changes during trade updates
    async trackCapitalChange(trades) {
        try {
            const currentCapital = await userSettingsService.getCurrentCapital(trades);

            await this.recordCapitalChange('trade_update', currentCapital, {
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
    }
};