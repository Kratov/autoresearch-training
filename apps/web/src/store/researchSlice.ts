import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'

export type ResearchMode = 'hyperparameter' | 'architecture' | 'optimizer' | 'efficiency' | 'custom'

interface ResearchConfig {
  mode: ResearchMode
  description: string
  parameters: Record<string, unknown>
}

interface ResearchState {
  currentMode: ResearchMode
  availableModes: ResearchConfig[]
  isRunning: boolean
  logs: string[]
  loading: boolean
  error: string | null
}

const initialState: ResearchState = {
  currentMode: 'custom',
  availableModes: [
    {
      mode: 'custom',
      description: 'Train a small GPT on Shakespeare - REAL GPU training (~2-3 min)',
      parameters: {},
    },
    {
      mode: 'hyperparameter',
      description: 'Learning rate, batch size, warmup - Quick parameter tuning (simulation)',
      parameters: {},
    },
    {
      mode: 'architecture',
      description: 'Layers, heads, embeddings - Model structure experiments (simulation)',
      parameters: {},
    },
    {
      mode: 'optimizer',
      description: 'AdamW, Muon, custom - Optimizer comparisons (simulation)',
      parameters: {},
    },
    {
      mode: 'efficiency',
      description: 'Speed, memory, convergence - Performance optimization (simulation)',
      parameters: {},
    },
  ],
  isRunning: false,
  logs: [],
  loading: false,
  error: null,
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export const startResearch = createAsyncThunk(
  'research/start',
  async (mode: ResearchMode) => {
    const response = await fetch(`${API_URL}/api/research/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    })
    if (!response.ok) throw new Error('Failed to start research')
    return response.json()
  }
)

export const stopResearch = createAsyncThunk(
  'research/stop',
  async () => {
    const response = await fetch(`${API_URL}/api/research/stop`, {
      method: 'POST',
    })
    if (!response.ok) throw new Error('Failed to stop research')
    return response.json()
  }
)

export const updateResearchConfig = createAsyncThunk(
  'research/updateConfig',
  async (mode: ResearchMode) => {
    const response = await fetch(`${API_URL}/api/research/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    })
    if (!response.ok) throw new Error('Failed to update config')
    return response.json()
  }
)

const researchSlice = createSlice({
  name: 'research',
  initialState,
  reducers: {
    setMode: (state, action: PayloadAction<ResearchMode>) => {
      state.currentMode = action.payload
    },
    addLog: (state, action: PayloadAction<string>) => {
      state.logs.push(action.payload)
      if (state.logs.length > 1000) {
        state.logs = state.logs.slice(-500)
      }
    },
    clearLogs: (state) => {
      state.logs = []
    },
    setRunning: (state, action: PayloadAction<boolean>) => {
      state.isRunning = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(startResearch.pending, (state) => {
        state.loading = true
        state.error = null
        state.logs = [] // Clear logs on new run
      })
      .addCase(startResearch.fulfilled, (state, action) => {
        state.loading = false
        state.isRunning = true
        state.logs.push(`[${new Date().toLocaleTimeString()}] Research started - Experiment ID: ${action.payload.experimentId}`)
      })
      .addCase(startResearch.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to start research'
      })
      .addCase(stopResearch.fulfilled, (state) => {
        state.isRunning = false
      })
      .addCase(updateResearchConfig.fulfilled, (state, action) => {
        state.currentMode = action.payload.mode
      })
  },
})

export const { setMode, addLog, clearLogs, setRunning } = researchSlice.actions
export default researchSlice.reducer
