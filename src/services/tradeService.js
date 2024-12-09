import { supabase } from '../config/supabaseClient';
import { TRADE_STATUS, ASSET_TYPES, DIRECTIONS } from '../features/trades/tradeModel';

export const tradeService = {
    // Create a new trade
    async createTrade(tradeData) {
        try {
            // Validate required fields
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

            // Prepare trade object
            const tradeToInsert = {
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
                
                // Calculate initial risk metrics
                risk_amount: Math.abs(total_shares * (entry_price - stop_loss_price)),
                
                // Additional default values
                unrealized_pnl: 0,
                realized_pnl: 0,
                market_value: total_shares * entry_price,
                user_id: (await supabase.auth.getUser()).data.user.id
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
    async updateTrade(tradeId, updateData) {
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
    async partialCloseTrade(tradeId, closedShares, exitPrice) {
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

            const updateData = {
                remaining_shares: remainingShares,
                realized_pnl: (currentTrade.realized_pnl || 0) + realizedPnl,
                unrealized_pnl: unrealizedPnl,
                status: remainingShares === 0 ? TRADE_STATUS.CLOSED : TRADE_STATUS.PARTIALLY_CLOSED,
                exit_price: exitPrice,
                exit_date: new Date().toISOString()
            };

            return this.updateTrade(tradeId, updateData);
        } catch (error) {
            console.error('Error in partial trade closure:', error);
            throw error;
        }
    },

    // Fetch user's trades
    async getUserTrades() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            
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
    calculateTradeMetrics(trade, currentPrice) {
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
