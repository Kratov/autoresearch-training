import { configureStore } from '@reduxjs/toolkit'
import experimentsReducer from './experimentsSlice'
import researchReducer from './researchSlice'
import settingsReducer from './settingsSlice'

export const store = configureStore({
  reducer: {
    experiments: experimentsReducer,
    research: researchReducer,
    settings: settingsReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
