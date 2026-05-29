import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'

export interface Experiment {
  id: string
  name: string
  mode: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  metrics: {
    loss?: number
    valLoss?: number
    accuracy?: number
    learningRate?: number
    epoch?: number
    iteration?: number
    parameters?: number
    [key: string]: unknown
  }
  createdAt: string
  completedAt?: string
}

interface ExperimentsState {
  items: Experiment[]
  currentExperiment: Experiment | null
  loading: boolean
  error: string | null
}

const initialState: ExperimentsState = {
  items: [],
  currentExperiment: null,
  loading: false,
  error: null,
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export const fetchExperiments = createAsyncThunk(
  'experiments/fetchAll',
  async () => {
    const response = await fetch(`${API_URL}/api/experiments`)
    if (!response.ok) throw new Error('Failed to fetch experiments')
    return response.json()
  }
)

export const fetchExperiment = createAsyncThunk(
  'experiments/fetchOne',
  async (id: string) => {
    const response = await fetch(`${API_URL}/api/experiments/${id}`)
    if (!response.ok) throw new Error('Failed to fetch experiment')
    return response.json()
  }
)

export const clearAllExperiments = createAsyncThunk(
  'experiments/clearAll',
  async () => {
    const response = await fetch(`${API_URL}/api/experiments`, {
      method: 'DELETE',
    })
    if (!response.ok) throw new Error('Failed to clear experiments')
    return response.json()
  }
)

const experimentsSlice = createSlice({
  name: 'experiments',
  initialState,
  reducers: {
    updateExperiment: (state, action: PayloadAction<Partial<Experiment> & { id: string }>) => {
      const index = state.items.findIndex(e => e.id === action.payload.id)
      if (index !== -1) {
        state.items[index] = { ...state.items[index], ...action.payload }
      }
      if (state.currentExperiment?.id === action.payload.id) {
        state.currentExperiment = { ...state.currentExperiment, ...action.payload }
      }
    },
    addExperiment: (state, action: PayloadAction<Experiment>) => {
      state.items.unshift(action.payload)
    },
    setCurrentExperiment: (state, action: PayloadAction<Experiment | null>) => {
      state.currentExperiment = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchExperiments.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchExperiments.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload
      })
      .addCase(fetchExperiments.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to fetch experiments'
      })
      .addCase(fetchExperiment.fulfilled, (state, action) => {
        state.currentExperiment = action.payload
      })
      .addCase(clearAllExperiments.fulfilled, (state) => {
        state.items = []
        state.currentExperiment = null
      })
  },
})

export const { updateExperiment, addExperiment, setCurrentExperiment } = experimentsSlice.actions
export default experimentsSlice.reducer
