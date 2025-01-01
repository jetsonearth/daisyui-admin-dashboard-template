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

export const fetchTradeDetails = createAsyncThunk(
    'tradeDetails/fetchData',
    async (tradeId: string) => {
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
                // Clear specific trade data
                delete state.trades[action.payload];
            } else {
                // Clear all data
                state.trades = {};
            }
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchTradeDetails.pending, (state, action) => {
                const tradeId = action.meta.arg;
                state.trades[tradeId] = {
                    ...state.trades[tradeId],
                    loading: true,
                    error: null
                };
            })
            .addCase(fetchTradeDetails.fulfilled, (state, action) => {
                const tradeId = action.meta.arg;
                state.trades[tradeId] = {
                    loading: false,
                    data: action.payload,
                    error: null,
                    lastUpdated: Date.now()
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

export const { clearTradeDetails } = tradeDetailsSlice.actions;

// Selectors
export const selectTradeDetails = (state: any, tradeId: string) => state.tradeDetails.trades[tradeId];

export default tradeDetailsSlice.reducer;
