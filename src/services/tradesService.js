import { supabase } from '../config/supabaseClient';

export const tradesService = {
    // Fetch all trades for the current user
    async getAllTrades() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No authenticated user');

            const { data, error } = await supabase
                .from('trades')
                .select('*')
                .eq('user_id', user.id);

            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('Error fetching trades:', error);
            throw error;
        }
    },

    // Add more trade-related methods as needed
    async createTrade(tradeData) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No authenticated user');

            const { data, error } = await supabase
                .from('trades')
                .insert({
                    ...tradeData,
                    user_id: user.id
                })
                .select()
                .single();

            if (error) throw error;

            return data;
        } catch (error) {
            console.error('Error creating trade:', error);
            throw error;
        }
    }
};
