// src/services/userSettingsService.js
import { supabase } from '../config/supabaseClient';

export const userSettingsService = {
    // Fetch user settings
    async getUserSettings() {
        try {
            console.time('supabase_auth_getUser');
            const { data: { user } } = await supabase.auth.getUser();
            console.timeEnd('supabase_auth_getUser');
            
            if (!user) throw new Error('No authenticated user');

            console.log('Fetching settings for user:', user.id);

            console.time('supabase_fetch_settings');
            const { data, error } = await supabase
                .from('user_settings')
                .select('*')
                .eq('user_id', user.id)
                .single();
            console.timeEnd('supabase_fetch_settings');

            console.log('Fetch settings response:', { data, error });

            if (error) {
                // If no settings exist, create default settings
                if (error.code === 'PGRST116') {
                    console.log('No existing settings, creating defaults');
                    return this.createDefaultSettings();
                }
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Comprehensive error fetching user settings:', {
                message: error.message,
                name: error.name,
                code: error.code,
                stack: error.stack
            });
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
                starting_cash: 0,
                name: '',
                email: user.email,
                trading_experience: null,
                preferred_trading_style: null,
                bio: null,
                automated_trade_logging: false,
                performance_alerts: false
            };

            console.log('Attempting to insert default settings:', defaultSettings);

            const { data, error } = await supabase
                .from('user_settings')
                .upsert(defaultSettings, { 
                    onConflict: 'user_id',
                    returning: 'representation'
                })
                .select()
                .single();

            console.log('Default settings insert/upsert response:', { data, error });

            if (error) {
                console.error('Error creating default settings:', error);
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Comprehensive error creating default settings:', {
                message: error.message,
                name: error.name,
                code: error.code,
                stack: error.stack
            });
            throw error;
        }
    },

    // Update or insert user settings
    async updateUserSettings(settings) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.error('No authenticated user');
                throw new Error('No authenticated user');
            }

            console.log('Updating settings for user:', user.id);
            console.log('Settings to update:', settings);

            // Prepare settings object with user_id
            const settingsToUpsert = {
                user_id: user.id,
                ...settings,
                updated_at: new Date().toISOString()
            };

            console.log('Prepared settings for upsert:', settingsToUpsert);

            const { data, error } = await supabase
                .from('user_settings')
                .upsert(settingsToUpsert, { 
                    onConflict: 'user_id',
                    returning: 'representation'
                })
                .select()
                .single();

            console.log('Upsert response:', { data, error });

            if (error) {
                console.error('Supabase upsert error:', {
                    message: error.message,
                    code: error.code,
                    details: error.details
                });
                throw error;
            }

            console.log('Settings saved successfully:', data);
            return data;
        } catch (error) {
            console.error('Comprehensive error updating user settings:', {
                message: error.message,
                name: error.name,
                code: error.code,
                stack: error.stack
            });
            throw error;
        }
    },


    // Get current capital (starting_cash + PnL)
    async getCurrentCapital(trades) {
        try {
            const settings = await this.getUserSettings();
            const startingCash = settings.starting_cash || 0;
            
            // Sum of all realized and unrealized PnL
            const totalPnL = trades.reduce((sum, trade) => 
                sum + (trade.realized_pnl || 0) + (trade.unrealized_pnl || 0), 
                0
            );

            return startingCash + totalPnL;
        } catch (error) {
            console.error('Error getting current capital:', error);
            throw error;
        }
    },

    // Update starting cash (for deposits/withdrawals)
    async updateStartingCash(newAmount) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No authenticated user');

            const { data, error } = await supabase
                .from('user_settings')
                .update({ starting_cash: newAmount })
                .eq('user_id', user.id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error updating starting cash:', error);
            throw error;
        }
    }
};