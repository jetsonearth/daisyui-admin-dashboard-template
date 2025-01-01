import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { marketDataService } from './marketDataService';
import { OHLCVData } from './marketDataService';

interface OHLCVState {
    data: {
        [tradeId: string]: {
            loading: boolean;
            data: OHLCVData[] | null;
            error: string | null;
            lastUpdated: number;
        };
    };
}

const initialState: OHLCVState = {
    data: {}
};

export const fetchOHLCVData = createAsyncThunk(
    'ohlcv/fetchData',
    async ({ ticker, startTime, endTime, tradeId }: { 
        ticker: string;
        startTime: Date;
        endTime: Date;
        tradeId: string;
    }) => {
        // console.log('🔄 Fetching OHLCV data for trade:', {
        //     tradeId,
        //     ticker,
        //     startTime: startTime.toISOString(),
        //     endTime: endTime.toISOString()
        // });
        
        const data = await marketDataService.getOHLCVData(ticker, startTime, endTime);
        return { data, tradeId };
    }
);

const ohlcvSlice = createSlice({
    name: 'ohlcv',
    initialState,
    reducers: {
        clearOHLCVData: (state, action) => {
            if (action.payload) {
                // Clear specific trade data
                delete state.data[action.payload];
            } else {
                // Clear all data
                state.data = {};
            }
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchOHLCVData.pending, (state, action) => {
                const tradeId = action.meta.arg.tradeId;
                state.data[tradeId] = {
                    ...state.data[tradeId],
                    loading: true,
                    error: null
                };
            })
            .addCase(fetchOHLCVData.fulfilled, (state, action) => {
                const { tradeId, data } = action.payload;
                state.data[tradeId] = {
                    loading: false,
                    data,
                    error: null,
                    lastUpdated: Date.now()
                };
            })
            .addCase(fetchOHLCVData.rejected, (state, action) => {
                const tradeId = action.meta.arg.tradeId;
                state.data[tradeId] = {
                    ...state.data[tradeId],
                    loading: false,
                    error: action.error.message || 'Failed to fetch data',
                };
            });
    }
});

export const { clearOHLCVData } = ohlcvSlice.actions;

// Selectors
export const selectOHLCVData = (state: any, tradeId: string) => state.ohlcv.data[tradeId];

export default ohlcvSlice.reducer;
