// Enums
export enum TRADE_STATUS {
    PLANNED = 'Planned',
    OPEN = 'Open',
    CLOSED = 'Closed',
    MISSED = 'Missed'
}

export enum ASSET_TYPES {
    STOCK = 'Stock',
    OPTION = 'Option',
    CRYPTO = 'Crypto',
    FOREX = 'Forex'
}

export enum DIRECTIONS {
    LONG = 'LONG',
    SHORT = 'SHORT'
}

export enum STRATEGIES {
    EP = 'Episodic Pivot',
    MB = 'Momentum Breakout',
    PBB = 'Pullback Buy'
}

// Setups as const array
export const SETUPS = [
    'EP', 'VCP', 'Inside Day', 'Inside Week', 'HTF', 
    'Flat Base', 'Bull Flag', 'PB', 'IPO Base', 
    'Ascending Triangle', 'Symmetric Triangle', 'Falling Wedge', 
    'Double Inside Week', 'Double Inside Day', 'HVE', 'HVY', 'HVQ', 
    'Rocket Base', 'Power Earning Gap'
] as const;

// Utility function
export function formatDateForUI(datetime?: string): string | null {
    if (!datetime) return null;
    const date = new Date(datetime);
    return date.toISOString().split('T')[0];
}

export interface Trade {
    // Identifiers (Required)
    id: string;
    user_id: string;
    
    // Basic Trade Info (Required)
    ticker: string;
    asset_type: string;
    direction: string;
    status: string;
    entry_price: number;
    stop_loss_price: number;
    total_shares: number;
    total_cost: number;
    remaining_shares: number;
    open_risk: number; // This is actually the SL distance in % from entry to stop loss
    realized_pnl: number;
    realized_pnl_percentage: number;
    unrealized_pnl: number;
    unrealized_pnl_percentage: number;
    last_price: number; 
    market_value: number;
    entry_date: string;
  
    // Optional Trade Info
    strategy?: string;
    setups?: string[];
    targets?: number[];
    risk_percentage?: number;
    portfolio_risk?: number;
    position_size?: number;
  
    // Entry/Exit Details
    entry_datetime?: string;
    exit_datetime?: string;
    exit_price?: number;
  
    // Risk Management
    stop_loss_33_percent?: number;
    stop_loss_66_percent?: number;
    initial_risk_amount?: number; // this is a fixed dollar value, its the amount of $ risked when placed the trade
    current_risk_amount?: number; // the amount of risk in dollar value from current price to trailin stop, if traling stop not set then use initial stop
    trailing_stoploss?: number;
    initial_position_risk?: number;
    current_var?: number;                 

    // Trade Metrics
    mae?: number; // mae in percentage
    mfe?: number; // mfe in percentage
    mae_dollars?: number;
    mfe_dollars?: number;
    mae_r?: number;
    mfe_r?: number;
    mae_price?: number;
    mfe_price?: number;
  
    // Portfolio Metrics
    portfolio_weight?: number; // the weight of the trade in the portfolio
    portfolio_impact?: number;
    trimmed_percentage?: number;
    risk_reward_ratio?: number;
  
    // Additional Metrics
    r_target_2?: number;
    r_target_3?: number;
    pnl?: number;
    r_multiple?: number;
    commission?: number;
    
    // Trade Planning
    watching?: boolean;
    ready?: boolean;
    atr?: number;
    lod?: number;
    
    // Timestamps
    created_at?: string;
    updated_at?: string;
    closed_at?: string;

    // Documenting actions
    action_types?: string[];
    action_datetimes?: string[];
    action_prices?: number[];
    action_shares?: number[];

    // Documenting notes and analysis
    notes?: string[];
    tags?: string[];
    mistakes?: string[];
    holding_period?: number;
    percent_from_entry?: number;
}

export interface WatchlistTrade {
    id: string;
    ticker: string;
    entry_price: number;
    stop_loss_price: number;
    total_shares: number;
    initial_risk_amount: number;
    portfolio_weight: number;
    direction: 'LONG' | 'SHORT';
    strategy?: string;
    setups?: string[];
    atr: number;
    lod: number;
    initial_position_risk: number;
    notes?: string;
    created_at: string;
    status: string;
    r_target_2?: number;
}