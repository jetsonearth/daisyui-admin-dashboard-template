export interface Trade {
    // Identifiers
    id: string;
    user_id: string;
    
    // Basic Trade Info
    ticker: string;
    asset_type: string;
    direction: string;
    status: string;
    strategy?: string;
    setups?: string[];
  
    // Entry Details
    entry_date: string;
    entry_datetime?: string;
    entry_price: number;
    total_shares: number;
    total_cost: number;
    remaining_shares: number;
  
    // Exit Details
    exit_datetime?: string;
    exit_price?: number;
  
    // Risk Management
    stop_loss_price: number;
    stop_loss_33_percent?: number;
    stop_loss_66_percent?: number;
    open_risk: number;
    risk_amount?: number;
  
    // Performance Metrics
    realized_pnl: number;
    realized_pnl_percentage: number;
    unrealized_pnl: number;
    unrealized_pnl_percentage: number;
    last_price: number;
    market_value: number;
  
    // Portfolio Metrics
    portfolio_weight?: number;
    portfolio_heat?: number;
    portfolio_impact?: number;
    trimmed_percentage?: number;
    risk_reward_ratio?: number;
  
    // Additional Metrics
    mae?: number;
    mfe?: number;
    mae_dollars?: number;
    mfe_dollars?: number;
    mae_r?: number;
    mfe_r?: number;
    
    // Timestamps
    created_at?: string;
    updated_at?: string;

    // Documenting actions
    action_types?: string[];
    action_datetimes?: string[];
    action_prices?: number[];
    action_shares?: number[];

    // Documenting notes
    notes?: string[];

    // Documenting mistakes
    mistakes?: string[];

    holding_period?: string;
    percent_from_entry?: number;
  }


// Enums
export enum TRADE_STATUS {
    OPEN = 'Open',
    CLOSED = 'Closed'
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