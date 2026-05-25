import { configureStore } from '@reduxjs/toolkit';
import appReducer from './appSlice.ts';

export const store = configureStore({
  reducer: {
    app: appReducer,
  },
  // Adding middleware checks fallback for serializable state in dev mode (Tauri API calls are asynchronous and result objects are plain objects)
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
