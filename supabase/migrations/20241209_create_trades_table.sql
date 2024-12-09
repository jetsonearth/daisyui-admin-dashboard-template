-- Create trades table with comprehensive trade tracking schema

CREATE TYPE trade_status AS ENUM ('Open', 'Closed');
CREATE TYPE trade_asset_type AS ENUM ('Stock', 'ETF', 'Option');
CREATE TYPE trade_direction AS ENUM ('LONG', 'SHORT');

CREATE TABLE trades (
    -- Identification
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Trade Basics
    ticker TEXT NOT NULL,
    asset_type trade_asset_type NOT NULL,
    direction trade_direction NOT NULL,
    status trade_status NOT NULL DEFAULT 'Open',
    
    -- Entry Details
    entry_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    entry_price NUMERIC NOT NULL,
    total_shares NUMERIC NOT NULL,
    
    -- Exit Details
    exit_price NUMERIC,
    exit_date TIMESTAMP WITH TIME ZONE,
    
    -- Risk Management
    stop_loss_price NUMERIC,
    stop_loss_33_percent NUMERIC,
    stop_loss_66_percent NUMERIC,
    take_profit_price NUMERIC,
    
    -- R-Multiple Targets
    r_target_2 NUMERIC,
    r_target_3 NUMERIC,
    
    -- Performance Metrics
    risk_amount NUMERIC,
    risk_reward_ratio NUMERIC,
    open_risk NUMERIC,
    
    -- Profit and Loss
    realized_pnl NUMERIC DEFAULT 0,
    unrealized_pnl NUMERIC DEFAULT 0,
    realized_percentage NUMERIC DEFAULT 0,
    unrealized_percentage NUMERIC DEFAULT 0,
    
    -- Trade Performance
    mae NUMERIC,
    mfe NUMERIC,
    
    -- Holding Period
    holding_period INTERVAL,
    
    -- Financial Metrics
    total_cost NUMERIC NOT NULL,
    market_value NUMERIC,
    weight_percentage NUMERIC,
    trimmed_percentage NUMERIC,
    portfolio_impact NUMERIC,
    
    -- Remaining Position
    remaining_shares NUMERIC,
    
    -- Strategy and Analysis
    strategy TEXT,
    setups TEXT[],
    
    -- Additional Context
    commission NUMERIC DEFAULT 0,
    notes TEXT,
    mistakes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to only access their own trades
CREATE POLICY "Users can only access their own trades" 
    ON trades FOR ALL 
    USING (auth.uid() = user_id);

-- Trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_trades_modtime
    BEFORE UPDATE ON trades
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- Optional: Create an index for faster querying
CREATE INDEX idx_trades_user_id ON trades(user_id);
CREATE INDEX idx_trades_ticker ON trades(ticker);
CREATE INDEX idx_trades_entry_date ON trades(entry_date);
