import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'

export interface TrainingSettings {
  n_layer: number
  n_head: number
  n_embd: number
  block_size: number
  dropout: number
  learning_rate: number
  batch_size: number
  max_iters: number
  eval_interval: number
  optimizer: 'adam' | 'adamw' | 'sgd'
  weight_decay: number
  beta1: number
  beta2: number
  autoImprove: boolean
  dataset: string
}

interface SettingsState {
  settings: TrainingSettings
  presets: Record<string, Partial<TrainingSettings>>
  isOpen: boolean
  loading: boolean
  error: string | null
}

const defaultSettings: TrainingSettings = {
  n_layer: 6,
  n_head: 6,
  n_embd: 384,
  block_size: 256,
  dropout: 0.2,
  learning_rate: 0.0003,
  batch_size: 64,
  max_iters: 500,
  eval_interval: 50,
  optimizer: 'adamw',
  weight_decay: 0.1,
  beta1: 0.9,
  beta2: 0.99,
  autoImprove: false,
  dataset: 'shakespeare',
}

const initialState: SettingsState = {
  settings: defaultSettings,
  presets: {
    fast_demo: {
      n_layer: 4,
      n_head: 4,
      n_embd: 256,
      max_iters: 200,
      eval_interval: 25,
    },
    balanced: {
      n_layer: 6,
      n_head: 6,
      n_embd: 384,
      max_iters: 500,
      eval_interval: 50,
    },
    high_quality: {
      n_layer: 8,
      n_head: 8,
      n_embd: 512,
      max_iters: 1000,
      eval_interval: 100,
    },
    tiny: {
      n_layer: 2,
      n_head: 2,
      n_embd: 128,
      max_iters: 100,
      eval_interval: 20,
    },
  },
  isOpen: false,
  loading: false,
  error: null,
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export const fetchSettings = createAsyncThunk('settings/fetch', async () => {
  const response = await fetch(`${API_URL}/api/settings`)
  if (!response.ok) throw new Error('Failed to fetch settings')
  return response.json()
})

export const updateSettings = createAsyncThunk(
  'settings/update',
  async (settings: Partial<TrainingSettings>) => {
    const response = await fetch(`${API_URL}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    if (!response.ok) throw new Error('Failed to update settings')
    return response.json()
  }
)

export const applyPreset = createAsyncThunk(
  'settings/applyPreset',
  async (preset: string) => {
    const response = await fetch(`${API_URL}/api/settings/preset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset }),
    })
    if (!response.ok) throw new Error('Failed to apply preset')
    return response.json()
  }
)

export const resetSettings = createAsyncThunk('settings/reset', async () => {
  const response = await fetch(`${API_URL}/api/settings/reset`, {
    method: 'POST',
  })
  if (!response.ok) throw new Error('Failed to reset settings')
  return response.json()
})

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    openSettings: (state) => {
      state.isOpen = true
    },
    closeSettings: (state) => {
      state.isOpen = false
    },
    setLocalSetting: (
      state,
      action: PayloadAction<{ key: keyof TrainingSettings; value: number | string | boolean }>
    ) => {
      const { key, value } = action.payload
      ;(state.settings as Record<string, unknown>)[key] = value
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSettings.pending, (state) => {
        state.loading = true
      })
      .addCase(fetchSettings.fulfilled, (state, action) => {
        state.loading = false
        state.settings = action.payload
      })
      .addCase(fetchSettings.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to fetch'
      })
      .addCase(updateSettings.fulfilled, (state, action) => {
        state.settings = action.payload
      })
      .addCase(applyPreset.fulfilled, (state, action) => {
        state.settings = action.payload
      })
      .addCase(resetSettings.fulfilled, (state, action) => {
        state.settings = action.payload
      })
  },
})

export const { openSettings, closeSettings, setLocalSetting } = settingsSlice.actions
export default settingsSlice.reducer
