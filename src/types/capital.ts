export interface CapitalSnapshot {
    id?: string;
    user_id: string;
    timestamp: Date;
    capital: number;
    high_watermark: number;
    current_drawdown: number;
    max_drawdown: number;
    max_runup: number;
    realized_pnl: number;
    unrealized_pnl: number;
    daily_high: number;
    daily_low: number;
    is_eod: boolean;
    trade_count: number;
    active_trade_count: number;
}

export interface DrawdownPeriod {
    start_date: Date;
    end_date?: Date;          
    start_capital: number;
    lowest_capital: number;
    recovery_capital?: number;
    drawdown_percentage: number;
    recovered: boolean;
}

export interface EquityPoint {
    date: Date;
    capital: number;
    drawdown: number;
    runup: number;
    realized_pnl: number;
    unrealized_pnl: number;
}

export interface CapitalMetrics {
    current_capital: number;
    starting_capital: number;
    total_realized_pnl: number;
    total_unrealized_pnl: number;
    max_drawdown: number;
    max_runup: number;
    current_drawdown: number;
    current_runup: number;
    average_drawdown: number;
    equity_curve: EquityPoint[];
    drawdown_periods: DrawdownPeriod[];
}

export interface DailyCapitalStats {
    date: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    realized_pnl: number;
    unrealized_pnl: number;
    trade_count: number;
}

export interface CapitalChangeMetadata {
    trade_details?: Array<{
        ticker: string;
        unrealized_pnl: number;
    }>;
}
