// src/app/store.ts
import { configureStore, ConfigureStoreOptions } from '@reduxjs/toolkit';
import headerSlice from '../features/common/headerSlice';
import modalSlice from '../features/common/modalSlice';
import rightDrawerSlice from '../features/common/rightDrawerSlice';
import leadsSlice from '../features/leads/leadSlice';
import tradesSlice from '../features/trades/tradesSlice';

const combinedReducer = {
  header: headerSlice,
  rightDrawer: rightDrawerSlice,
  modal: modalSlice,
  lead: leadsSlice,
  trades: tradesSlice
};

const storeConfig: ConfigureStoreOptions = {
  reducer: combinedReducer
};

const store = configureStore(storeConfig);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;