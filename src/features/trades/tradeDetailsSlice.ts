import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { supabase } from '../../config/supabaseClient';
import { Trade } from '../../types';

interface TradeDetailsState {
    trades: {
        [tradeId: string]: {
            loading: boolean;
            data: Trade | null;
            error: string | null;
            lastUpdated: number;
        };
    };
}

const initialState: TradeDetailsState = {
    trades: {}
};

// Add cache duration constant
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const fetchTradeDetails = createAsyncThunk(
    'tradeDetails/fetchData',
    async (tradeId: string, { getState }) => {
        // Check if we have cached data
        const state = getState() as any;
        const cachedTrade = state.tradeDetails.trades[tradeId];
        const now = Date.now();

        if (cachedTrade && cachedTrade.data && (now - cachedTrade.lastUpdated) < CACHE_DURATION) {
            console.log('📦 Using cached trade data for', tradeId);
            return cachedTrade.data;
        }

        console.log('🔄 Fetching fresh trade data for', tradeId);
        const { data, error } = await supabase
            .from('trades')
            .select('*, action_types, action_datetimes, action_prices, action_shares, notes, mistakes')
            .eq('id', tradeId)
            .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('Trade not found');

        return data;
    }
);

const tradeDetailsSlice = createSlice({
    name: 'tradeDetails',
    initialState,
    reducers: {
        clearTradeDetails: (state, action) => {
            if (action.payload) {
                delete state.trades[action.payload];
            } else {
                state.trades = {};
            }
        },
        clearExpiredCache: (state) => {
            const now = Date.now();
            Object.keys(state.trades).forEach(tradeId => {
                const trade = state.trades[tradeId];
                if (now - trade.lastUpdated > CACHE_DURATION) {
                    delete state.trades[tradeId];
                }
            });
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchTradeDetails.pending, (state, action) => {
                const tradeId = action.meta.arg;
                state.trades[tradeId] = {
                    ...state.trades[tradeId],
                    loading: true,
                    error: null,
                };
            })
            .addCase(fetchTradeDetails.fulfilled, (state, action) => {
                const tradeId = action.meta.arg;
                state.trades[tradeId] = {
                    loading: false,
                    data: action.payload,
                    error: null,
                    lastUpdated: Date.now(),
                };
            })
            .addCase(fetchTradeDetails.rejected, (state, action) => {
                const tradeId = action.meta.arg;
                state.trades[tradeId] = {
                    ...state.trades[tradeId],
                    loading: false,
                    error: action.error.message || 'Failed to fetch trade details',
                };
            });
    }
});

export const { clearTradeDetails, clearExpiredCache } = tradeDetailsSlice.actions;

// Selectors
export const selectTradeDetails = (state: any, tradeId: string) => state.tradeDetails.trades[tradeId];

export default tradeDetailsSlice.reducer;
