import { createSlice } from '@reduxjs/toolkit'
import { SAMPLE_TRADES } from './tradeModel'

const initialState = {
    trades: [],
    loading: false,
    error: null
}

export const tradesSlice = createSlice({
    name: 'trades',
    initialState,
    reducers: {
        addTrade: (state, action) => {
            state.trades.push(action.payload)
        },
        updatePosition: (state, action) => {
            const index = state.trades.findIndex(trade => 
                trade.ticker === action.payload.ticker && 
                trade.direction === action.payload.direction &&
                trade.status === 'open'
            )
            if (index !== -1) {
                state.trades[index] = action.payload
            }
        },
        updateTradePrice: (state, action) => {
            const { ticker, currentPrice } = action.payload
            state.trades.forEach(trade => {
                if (trade.ticker === ticker && trade.status === 'open') {
                    trade.last_price = currentPrice
                    trade.market_value = currentPrice * trade.remaining_shares
                    trade.unrealized_pnl = trade.market_value - (trade.entry_price * trade.remaining_shares)
                    trade.unrealized_percentage = ((trade.market_value - (trade.entry_price * trade.remaining_shares)) / (trade.entry_price * trade.remaining_shares)) * 100
                    trade.entry_price = trade.entry_price // preserve entry_price
                    trade.remaining_shares = trade.remaining_shares // preserve remaining_shares
                }
            })
        },
        closeTrade: (state, action) => {
            const { id, exitPrice, exitDate } = action.payload
            const trade = state.trades.find(t => t.id === id)
            if (trade) {
                trade.status = 'closed'
                trade.exit_price = exitPrice
                trade.exit_date = exitDate
                trade.realized_pnl = (exitPrice - trade.avg_cost) * trade.shares_remaining
                trade.realized_pnl_percentage = ((exitPrice - trade.avg_cost) / trade.avg_cost) * 100
                trade.shares_remaining = 0
            }
        }
    }
})

// Export actions
export const { addTrade, updatePosition, updateTradePrice, closeTrade } = tradesSlice.actions

// Selectors
export const selectAllTrades = state => state.trades.trades
export const selectOpenTrades = state => state.trades.trades.filter(trade => trade.status === 'open')
export const selectClosedTrades = state => state.trades.trades.filter(trade => trade.status === 'closed')
export const selectTradesByTicker = (state, ticker) => state.trades.trades.filter(trade => trade.ticker === ticker)

export default tradesSlice.reducer
