// tradeService.ts
import { supabase } from '../config/supabaseClient';
import { TRADE_STATUS, ASSET_TYPES, DIRECTIONS, Trade } from '../types';

interface TradeCreateData {
    ticker: string;
    asset_type: ASSET_TYPES;
    direction: DIRECTIONS;
    entry_price: number;
    total_shares: number;
    total_cost: number;
    stop_loss_price: number;
    strategy?: string;
    setups?: string[];
}

interface TradeUpdateData {
    remaining_shares?: number;
    realized_pnl?: number;
    unrealized_pnl?: number;
    status?: TRADE_STATUS;
    exit_price?: number;
    exit_date?: string;
    
    // Add all potential update fields from the Trade interface
    trimmed_percentage?: number;
    portfolio_weight?: number;
    portfolio_impact?: number;
    portfolio_heat?: number;
    realized_pnl_percentage?: number;
    risk_reward_ratio?: number;
    last_price?: number;
    market_value?: number;
    unrealized_pnl_percentage?: number;
    mae?: number;
    mfe?: number;
}

export const tradeService = {
    // Create a new trade
    async createTrade(tradeData: TradeCreateData): Promise<Trade> {
        try {
            const {
                ticker, 
                asset_type, 
                direction, 
                entry_price, 
                total_shares,
                total_cost,
                stop_loss_price,
                strategy,
                setups
            } = tradeData;
    
            // Calculate risk amount
            const riskAmount = Math.abs(total_shares * (entry_price - stop_loss_price));
    
            // Safely get user ID
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                throw new Error('No authenticated user found');
            }
    
            // Prepare trade object
            const tradeToInsert: Partial<Trade> = {
                ticker,
                asset_type,
                direction,
                status: TRADE_STATUS.OPEN,
                entry_date: new Date().toISOString(),
                entry_price,
                total_shares,
                remaining_shares: total_shares,
                total_cost,
                stop_loss_price,
                strategy,
                setups,
                
                // Add risk amount
                risk_amount: riskAmount,
                
                // Additional default values
                unrealized_pnl: 0,
                realized_pnl: 0,
                market_value: total_shares * entry_price,
                user_id: user.id
            };
    
            const { data, error } = await supabase
                .from('trades')
                .insert(tradeToInsert)
                .select();
    
            if (error) throw error;
            return data[0];
        } catch (error) {
            console.error('Error creating trade:', error);
            throw error;
        }
    },

    // Update an existing trade
    async updateTrade(tradeId: string, updateData: TradeUpdateData): Promise<Trade> {
        try {
            const { data, error } = await supabase
                .from('trades')
                .update(updateData)
                .eq('id', tradeId)
                .select();

            if (error) throw error;
            return data[0];
        } catch (error) {
            console.error('Error updating trade:', error);
            throw error;
        }
    },

    // Partially close a trade
    async partialCloseTrade(tradeId: string, closedShares: number, exitPrice: number): Promise<Trade> {
        try {
            // Fetch current trade details
            const { data: currentTrade, error: fetchError } = await supabase
                .from('trades')
                .select('*')
                .eq('id', tradeId)
                .single();
    
            if (fetchError) throw fetchError;
    
            // Calculate partial closure metrics
            const remainingShares = currentTrade.remaining_shares - closedShares;
            const realizedPnl = closedShares * (exitPrice - currentTrade.entry_price);
            const unrealizedPnl = remainingShares * (exitPrice - currentTrade.entry_price);
    
            const updateData: TradeUpdateData = {
                remaining_shares: remainingShares,
                realized_pnl: (currentTrade.realized_pnl || 0) + realizedPnl,
                unrealized_pnl: unrealizedPnl,
                status: remainingShares === 0 ? TRADE_STATUS.CLOSED : TRADE_STATUS.OPEN,
                exit_price: exitPrice,
                exit_date: new Date().toISOString()
            };
    
            return this.updateTrade(tradeId, updateData);
        } catch (error) {
            console.error('Error in partial trade closure:', error);
            throw error;
        }
    },

    async getUserTrades(): Promise<Trade[]> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            
            if (!user) {
                throw new Error('No authenticated user found');
            }
            
            const { data, error } = await supabase
                .from('trades')
                .select('*')
                .eq('user_id', user.id)
                .order('entry_date', { ascending: false });
    
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching trades:', error);
            throw error;
        }
    },

    // Calculate trade metrics
    calculateTradeMetrics(trade: Trade, currentPrice: number) {
        const unrealizedPnl = trade.remaining_shares * (currentPrice - trade.entry_price);
        const unrealizedPercentage = (unrealizedPnl / trade.total_cost) * 100;

        return {
            unrealized_pnl: unrealizedPnl,
            unrealized_percentage: unrealizedPercentage,
            market_value: trade.remaining_shares * currentPrice,
            // Add more metric calculations as needed
        };
    }
};

export default tradeService;