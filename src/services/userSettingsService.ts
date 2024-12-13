import { supabase } from '../config/supabaseClient';

interface UserSettings {
    user_id: string;
    starting_cash: number;
    current_capital?: number;  // Add this, matching the Supabase schema
    name: string;
    email: string;
    trading_experience?: number | null;
    preferred_trading_style?: string | null;
    bio?: string | null;
    automated_trade_logging: boolean;
    performance_alerts: boolean;
    created_at?: string;
    updated_at?: string;
}

interface PartialUserSettings {
    starting_cash?: number;
    current_capital?: number;  
    name?: string;
    trading_experience?: number | null;
    preferred_trading_style?: string | null;
    bio?: string | null;
    automated_trade_logging?: boolean;
    performance_alerts?: boolean;
}

interface CapitalInfo {
    current_capital: number;
    starting_cash: number;
    total_realized_pnl: number;
    total_unrealized_pnl: number;
}

type ErrorWithCode = {
    message: string;
    name: string;
    code?: string;
    stack?: string;
};

export const userSettingsService = {
    // Fetch user settings
    async getUserSettings(): Promise<UserSettings> {
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
            const typedError = error as ErrorWithCode;
            console.error('Comprehensive error fetching user settings:', {
                message: typedError.message,
                name: typedError.name,
                code: typedError.code,
                stack: typedError.stack
            });
            throw error;
        }
    },

    // Create default settings if not exists
    async createDefaultSettings(): Promise<UserSettings> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No authenticated user');

            const defaultSettings: UserSettings = {
                user_id: user.id,
                starting_cash: 0,
                name: '',
                email: user.email || '',
                trading_experience: null,
                preferred_trading_style: null,
                bio: null,
                automated_trade_logging: false,
                performance_alerts: false
            };

            console.log('Attempting to insert default settings:', defaultSettings);

            const { data, error } = await supabase
            .from('user_settings')
            .upsert([defaultSettings], { 
                onConflict: 'user_id'
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
            const typedError = error as ErrorWithCode;
            console.error('Comprehensive error creating default settings:', {
                message: typedError.message,
                name: typedError.name,
                code: typedError.code,
                stack: typedError.stack
            });
            throw error;
        }
    },

    async updateUserSettings(settings: PartialUserSettings): Promise<UserSettings> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.error('No authenticated user');
                throw new Error('No authenticated user');
            }
    
            // First, fetch existing settings to preserve starting_cash
            const { data: existingSettings, error: fetchError } = await supabase
                .from('user_settings')
                .select('starting_cash')
                .eq('user_id', user.id)
                .single();
    
            if (fetchError && fetchError.code !== 'PGRST116') {
                console.error('Error fetching existing settings:', fetchError);
                throw fetchError;
            }
    
            // Prepare settings object, preserving starting_cash
            const settingsToUpsert: UserSettings = {
                user_id: user.id,
                starting_cash: existingSettings?.starting_cash || 0,
                name: '',
                email: user.email || '',
                trading_experience: null,
                preferred_trading_style: null,
                bio: null,
                automated_trade_logging: false,
                performance_alerts: false,
                ...settings,
                updated_at: new Date().toISOString()
            };
    
            console.log('Prepared settings for upsert:', settingsToUpsert);
    
            const { data, error } = await supabase
            .from('user_settings')
            .upsert([settingsToUpsert], { 
                onConflict: 'user_id'
            })
            .select()
            .single();
        
        if (error) {
            const typedError = error as ErrorWithCode;
            console.error('Supabase upsert error:', {
                message: typedError.message,
                code: typedError.code,
                details: 'details' in typedError ? typedError.details : undefined
            });
            throw error;
        }
    
            console.log('Settings saved successfully:', data);
            return data;
        } catch (error) {
            const typedError = error as ErrorWithCode;
            console.error('Comprehensive error updating user settings:', {
                message: typedError.message,
                name: typedError.name,
                code: typedError.code,
                stack: typedError.stack
            });
            throw error;
        }
    },

    // Get current capital (starting_cash + PnL)
    async getCurrentCapital(): Promise<number> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            
            if (!user) {
                throw new Error('No authenticated user');
            }
            
            const { data, error } = await supabase.rpc('calculate_user_capital', {
                input_user_id: user.id
            });
    
            if (error) {
                console.error('Capital Calculation Error:', error);
                throw error;
            }
    
            const capitalInfo: CapitalInfo = data[0];
            console.log('Capital Breakdown:', capitalInfo);
    
            return capitalInfo.current_capital;
        } catch (error) {
            const typedError = error as ErrorWithCode;
            console.error('Error calculating capital:', {
                message: typedError.message,
                name: typedError.name,
                code: typedError.code,
                stack: typedError.stack
            });
            throw error;
        }
    },

    // Update starting cash (for deposits/withdrawals)
    async updateStartingCash(newAmount: number): Promise<UserSettings> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No authenticated user');
    
            const { data, error } = await supabase
                .from('user_settings')
                .update({ starting_cash: newAmount })
                .eq('user_id', user.id)
                .select()
                .single();
    
            if (error) {
                const typedError = error as ErrorWithCode;
                console.error('Error updating starting cash:', {
                    message: typedError.message,
                    code: typedError.code,
                    details: 'details' in typedError ? typedError.details : undefined
                });
                throw error;
            }
    
            return data;
        } catch (error) {
            const typedError = error as ErrorWithCode;
            console.error('Comprehensive error updating starting cash:', {
                message: typedError.message,
                name: typedError.name,
                code: typedError.code,
                stack: typedError.stack
            });
            throw error;
        }
    }
};