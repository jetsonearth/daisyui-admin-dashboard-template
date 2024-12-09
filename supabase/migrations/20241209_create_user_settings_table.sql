-- supabase/migrations/20241209_create_user_settings_table.sql

-- Create user settings table
CREATE TABLE public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id),
    starting_cash NUMERIC(15, 2) DEFAULT 100000.00,
    name TEXT,
    email TEXT,
    trading_experience INTEGER,
    preferred_trading_style TEXT,
    bio TEXT,
    automated_trade_logging BOOLEAN DEFAULT false,
    performance_alerts BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Revoke all default permissions
REVOKE ALL ON public.user_settings FROM public;
REVOKE ALL ON public.user_settings FROM authenticated;

-- Create a policy for user-specific access
CREATE POLICY user_settings_access_policy 
ON public.user_settings 
FOR ALL 
USING (auth.uid() = user_id);

-- Grant permissions to authenticated users
GRANT SELECT, UPDATE ON public.user_settings TO authenticated;

-- Trigger to automatically update 'updated_at'
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_settings_modtime
BEFORE UPDATE ON public.user_settings
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();