// src/app/store.ts
import { configureStore, ConfigureStoreOptions } from '@reduxjs/toolkit';
import headerSlice from '../features/common/headerSlice';
import modalSlice from '../features/common/modalSlice';
import rightDrawerSlice from '../features/common/rightDrawerSlice';
import leadsSlice from '../features/leads/leadSlice';
import tradesSlice from '../features/trades/tradesSlice';
import ohlcvCacheReducer from '../features/marketData/ohlcvCacheSlice';
import ohlcvReducer from '../features/marketData/ohlcvSlice';
import tradeDetailsReducer from '../features/trades/tradeDetailsSlice';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';

// Configure persistence for OHLCV cache
const ohlcvCachePersistConfig = {
  key: 'ohlcvCache',
  storage,
  whitelist: ['cache'], // Only persist the cache field
};

const ohlcvPersistConfig = {
  key: 'ohlcv',
  storage,
  whitelist: ['data', 'lastUpdated'], // Only persist data and lastUpdated
};

const tradeDetailsPersistConfig = {
  key: 'tradeDetails',
  storage,
  whitelist: ['trades'] // only persist trades
};

const combinedReducer = {
  header: headerSlice,
  rightDrawer: rightDrawerSlice,
  modal: modalSlice,
  lead: leadsSlice,
  trades: tradesSlice,
  ohlcvCache: persistReducer(ohlcvCachePersistConfig, ohlcvCacheReducer),
  ohlcv: persistReducer(ohlcvPersistConfig, ohlcvReducer),
  tradeDetails: persistReducer(tradeDetailsPersistConfig, tradeDetailsReducer)
};

const storeConfig: ConfigureStoreOptions = {
  reducer: combinedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
};

export const store = configureStore(storeConfig);
export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;