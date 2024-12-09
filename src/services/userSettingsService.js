// src/services/userSettingsService.js
import { supabase } from '../config/supabaseClient';

export const userSettingsService = {
    // Fetch user settings
    async getUserSettings() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No authenticated user');

            const { data, error } = await supabase
                .from('user_settings')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (error) {
                // If no settings exist, create default settings
                if (error.code === 'PGRST116') {
                    return this.createDefaultSettings();
                }
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Error fetching user settings:', error);
            throw error;
        }
    },

    // Create default settings if not exists
    async createDefaultSettings() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No authenticated user');

            const defaultSettings = {
                user_id: user.id,
                starting_cash: 100000.00,
                name: '',
                email: user.email,
                trading_experience: null,
                preferred_trading_style: null,
                bio: null,
                automated_trade_logging: false,
                performance_alerts: false
            };

            const { data, error } = await supabase
                .from('user_settings')
                .insert(defaultSettings)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error creating default settings:', error);
            throw error;
        }
    },

    // Update user settings
    async updateUserSettings(settings) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No authenticated user');

            const { data, error } = await supabase
                .from('user_settings')
                .update({
                    ...settings,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', user.id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error updating user settings:', error);
            throw error;
        }
    }
};