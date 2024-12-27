import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { WatchlistTrade } from '../../types';
import { supabase } from '../../config/supabaseClient';

interface TradePlansState {
    trades: WatchlistTrade[];
    loading: boolean;
    error: string | null;
    lastFetched: number | null;
}

const initialState: TradePlansState = {
    trades: [],
    loading: false,
    error: null,
    lastFetched: null
};

// Fetch trade plans
export const fetchTradePlans = createAsyncThunk(
    'tradePlans/fetchTradePlans',
    async (_, { rejectWithValue }) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');

            const { data, error } = await supabase
                .from('watchlist')
                .select('*')
                .eq('user_id', user.id)
                .order('added_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Add trade plan
export const addTradePlan = createAsyncThunk(
    'tradePlans/addTradePlan',
    async (trade: Omit<WatchlistTrade, 'id'>, { rejectWithValue }) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');

            const { data, error } = await supabase
                .from('watchlist')
                .insert([{ ...trade, user_id: user.id }])
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Delete trade plan
export const deleteTradePlan = createAsyncThunk(
    'tradePlans/deleteTradePlan',
    async (tradeId: string, { rejectWithValue }) => {
        try {
            const { error } = await supabase
                .from('watchlist')
                .delete()
                .eq('id', tradeId);

            if (error) throw error;
            return tradeId;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

const tradePlansSlice = createSlice({
    name: 'tradePlans',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            // Fetch trade plans
            .addCase(fetchTradePlans.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchTradePlans.fulfilled, (state, action) => {
                state.trades = action.payload;
                state.loading = false;
                state.lastFetched = Date.now();
            })
            .addCase(fetchTradePlans.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Add trade plan
            .addCase(addTradePlan.fulfilled, (state, action) => {
                state.trades.unshift(action.payload);
            })
            // Delete trade plan
            .addCase(deleteTradePlan.fulfilled, (state, action) => {
                state.trades = state.trades.filter(trade => trade.id !== action.payload);
            });
    }
});

export default tradePlansSlice.reducer;
