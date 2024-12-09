import { TRADE_STATUS } from './tradeModel'

// Helper function to calculate new average cost
export const calculateNewAvgCost = (existingPosition, newTrade) => {
    const totalShares = existingPosition.total_shares + newTrade.shares
    const totalCost = (existingPosition.avg_cost * existingPosition.total_shares) + 
                     (newTrade.entryPrice * newTrade.shares)
    return totalCost / totalShares
}

// Helper function to check if a trade is an add-on to an existing position
export const isAddOnPosition = (existingTrades, newTrade) => {
    return existingTrades.some(trade => 
        trade.ticker === newTrade.ticker && 
        trade.direction === newTrade.direction &&
        trade.status === TRADE_STATUS.OPEN
    )
}

// Process new trade entry
export const processTradeEntry = (existingTrades, newTrade) => {
    const isAddOn = isAddOnPosition(existingTrades, newTrade)
    
    if (isAddOn) {
        // Find existing position
        const existingPosition = existingTrades.find(trade => 
            trade.ticker === newTrade.ticker && 
            trade.direction === newTrade.direction &&
            trade.status === TRADE_STATUS.OPEN
        )

        // Calculate new position details
        const newAvgCost = calculateNewAvgCost(existingPosition, newTrade)
        const totalShares = existingPosition.total_shares + newTrade.shares
        const totalCost = newAvgCost * totalShares
        const marketValue = newTrade.currentPrice * totalShares

        // Update existing position
        const updatedPosition = {
            ...existingPosition,
            avg_cost: newAvgCost,
            total_shares: totalShares,
            shares_remaining: totalShares,
            total_cost: totalCost,
            market_value: marketValue,
            // Keep original stop losses
            initial_stop_loss: existingPosition.initial_stop_loss,
            stop_loss_33: existingPosition.stop_loss_33,
            stop_loss_66: existingPosition.stop_loss_66,
            stop_loss_100: existingPosition.stop_loss_100,
            // Update P&L
            unrealized_pnl: marketValue - totalCost,
            unrealized_pnl_percentage: ((marketValue - totalCost) / totalCost) * 100,
            last_price: newTrade.currentPrice
        }

        return {
            type: 'ADD_ON',
            position: updatedPosition
        }
    } else {
        // Create new position
        const totalCost = newTrade.shares * newTrade.entryPrice
        const marketValue = newTrade.shares * newTrade.currentPrice

        const newPosition = {
            ticker: newTrade.ticker,
            asset_type: newTrade.assetType,
            direction: newTrade.direction,
            status: TRADE_STATUS.OPEN,
            entry_date: new Date().toISOString().split('T')[0],
            avg_cost: newTrade.entryPrice,
            total_shares: newTrade.shares,
            shares_remaining: newTrade.shares,
            total_cost: totalCost,
            market_value: marketValue,
            strategy: newTrade.strategy,
            setups: [newTrade.setup],
            initial_stop_loss: newTrade.fullStopPrice,
            stop_loss_33: newTrade.stop33,
            stop_loss_66: newTrade.stop66,
            stop_loss_100: newTrade.fullStopPrice,
            unrealized_pnl: marketValue - totalCost,
            unrealized_pnl_percentage: ((marketValue - totalCost) / totalCost) * 100,
            risk_reward_ratio: newTrade.rrr,
            open_risk: newTrade.openRisk,
            mae: 0,
            mfe: 0,
            last_price: newTrade.currentPrice
        }

        return {
            type: 'NEW_POSITION',
            position: newPosition
        }
    }
}
