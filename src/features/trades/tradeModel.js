// Trade status options
export const TRADE_STATUS = {
    OPEN: 'Open',
    CLOSED: 'Closed'
};

// Asset types
export const ASSET_TYPES = {
    STOCK: 'Stock',
    ETF: 'ETF',
    OPTION: 'Option'
};

// Trade directions
export const DIRECTIONS = {
    LONG: 'LONG',
    SHORT: 'SHORT'
};

// Strategies
export const STRATEGIES = {
    EP: 'EP',
    MB: 'MB',
    PBB: 'PBB',
};

// Setups
export const SETUPS = [
    'EP',
    'VCP',
    'Inside Day',
    'Inside Week',
    'HTF',
    'Flat Base',
    'Bull Flag',
    'PB',
    'IPO Base',
    'Triangle',
    'Falling Wedge'
];

// Utility function to format datetime to date (only date, no time)
export const formatDateForUI = (datetime) => {
    if (!datetime) return null;
    const date = new Date(datetime);
    return date.toISOString().split('T')[0];
};

// Trade model schema
export const TradeSchema = {
    id: 'string', // UUID
    user_id: 'string', // Optional, for multi-user support
    
    // Basic Trade Information
    ticker: 'string',
    asset_type: Object.values(ASSET_TYPES),
    direction: Object.values(DIRECTIONS),
    status: Object.values(TRADE_STATUS),
    
    // Entry Details
    entry_datetime: 'timestamp', // Full timestamp
    entry_date: 'date', // Computed/displayed date
    entry_price: 'decimal',
    total_shares: 'integer',
    total_cost: 'decimal',
    
    // Exit Details
    exit_price: 'decimal', // Final price point
    exit_datetime: 'timestamp',
    exit_date: 'date',
    
    // Stop Loss and Targets
    stop_loss_price: 'decimal', // 100% stop loss
    stop_loss_33_percent: 'decimal',
    stop_loss_66_percent: 'decimal',
    r_target_2: 'decimal', // 2R target
    r_target_3: 'decimal', // 3R target
    
    // Risk and Performance Metrics
    risk_reward_ratio: 'decimal',
    risk_amount: 'decimal', // New field
    open_risk: 'decimal', // Potential portfolio downside
    
    // Profit and Loss
    realized_pnl: 'decimal',
    unrealized_pnl: 'decimal',
    realized_percentage: 'decimal',
    unrealized_percentage: 'decimal',
    
    // Performance Excursions (now in percentage)
    mae_percentage: 'decimal', // Maximum Adverse Excursion %
    mfe_percentage: 'decimal', // Maximum Favorable Excursion %
    
    // Additional Trade Metrics
    holding_period: 'string',
    market_value: 'decimal',
    weight_percentage: 'decimal',
    trimmed_percentage: 'decimal',
    portfolio_impact: 'decimal',
    remaining_shares: 'decimal',
    
    // Trade Classification
    strategy: Object.values(STRATEGIES),
    setups: [SETUPS], // Array of setups
    
    // Additional Information
    commission: 'decimal',
    notes: 'string',
    mistakes: 'string',
    
    // Timestamp Fields
    created_at: 'timestamp',
    updated_at: 'timestamp',
    
    // Optional Fields
    last_price: 'decimal'
};

// Sample trades for development
export const SAMPLE_TRADES = [
    {
        id: '1',
        ticker: 'AAPL',
        asset_type: ASSET_TYPES.STOCK,
        direction: DIRECTIONS.LONG,
        status: TRADE_STATUS.OPEN,
        entry_datetime: '2023-12-06T14:30:00.000Z',
        entry_date: formatDateForUI('2023-12-06T14:30:00.000Z'),
        entry_price: 150.00,
        total_shares: 100,
        total_cost: 15000,
        exit_price: null,
        exit_datetime: null,
        exit_date: null,
        stop_loss_price: 145.00,
        stop_loss_33_percent: 146.00,
        stop_loss_66_percent: 147.50,
        r_target_2: 165.00,
        r_target_3: 180.00,
        risk_reward_ratio: 3.5,
        risk_amount: 2.5,
        open_risk: 2.5,
        realized_pnl: 0,
        unrealized_pnl: 0,
        realized_percentage: 0,
        unrealized_percentage: 0,
        mae_percentage: -2.1,
        mfe_percentage: 4.2,
        holding_period: '1 day',
        market_value: 15000,
        weight_percentage: 5,
        trimmed_percentage: 25,
        portfolio_impact: 2.5,
        remaining_shares: 100,
        strategy: STRATEGIES.MB,
        setups: ['VCP', 'Bull Flag'],
        commission: 0,
        notes: '',
        mistakes: '',
        created_at: '2023-12-06',
        updated_at: '2023-12-06',
        last_price: null
    },
    {
        id: '2',
        ticker: 'NVDA',
        asset_type: ASSET_TYPES.STOCK,
        direction: DIRECTIONS.LONG,
        status: TRADE_STATUS.OPEN,
        entry_datetime: '2023-12-05T14:30:00.000Z',
        entry_date: formatDateForUI('2023-12-05T14:30:00.000Z'),
        entry_price: 465.00,
        total_shares: 50,
        total_cost: 23250,
        exit_price: null,
        exit_datetime: null,
        exit_date: null,
        stop_loss_price: 450.00,
        stop_loss_33_percent: 455.00,
        stop_loss_66_percent: 460.00,
        r_target_2: 505.00,
        r_target_3: 545.00,
        risk_reward_ratio: 3.2,
        risk_amount: 3.0,
        open_risk: 3.0,
        realized_pnl: 0,
        unrealized_pnl: 0,
        realized_percentage: 0,
        unrealized_percentage: 0,
        mae_percentage: -1.5,
        mfe_percentage: 3.1,
        holding_period: '1 day',
        market_value: 23250,
        weight_percentage: 8,
        trimmed_percentage: 30,
        portfolio_impact: 3.8,
        remaining_shares: 50,
        strategy: STRATEGIES.EP,
        setups: ['EP', 'HTF'],
        commission: 0,
        notes: '',
        mistakes: '',
        created_at: '2023-12-05',
        updated_at: '2023-12-05',
        last_price: null
    }
];