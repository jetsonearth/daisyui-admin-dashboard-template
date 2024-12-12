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
    exit_date?: string;
    exit_price?: number;
  
    // Risk Management
    stop_loss_price: number;
    stop_loss_33_percent?: number;
    stop_loss_66_percent?: number;
    open_risk: number;
  
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
    
    // Timestamps
    created_at?: string;
    updated_at?: string;
  }


// Enums
export enum TRADE_STATUS {
    OPEN = 'Open',
    CLOSED = 'Closed'
}

export enum ASSET_TYPES {
    STOCK = 'Stock',
    ETF = 'ETF',
    OPTION = 'Option'
}

export enum DIRECTIONS {
    LONG = 'LONG',
    SHORT = 'SHORT'
}

export enum STRATEGIES {
    EP = 'EP',
    MB = 'MB',
    PBB = 'PBB'
}

// Setups as const array
export const SETUPS = [
    'EP', 'VCP', 'Inside Day', 'Inside Week', 'HTF', 
    'Flat Base', 'Bull Flag', 'PB', 'IPO Base', 
    'Triangle', 'Falling Wedge', 'Double Inside Week',
    'Double Inside Day', 'HVE', 'HVY', 'HVQ'
] as const;

// Utility function
export function formatDateForUI(datetime?: string): string | null {
    if (!datetime) return null;
    const date = new Date(datetime);
    return date.toISOString().split('T')[0];
}