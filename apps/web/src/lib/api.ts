const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_URL}/api${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(error.message || `HTTP ${response.status}`)
  }

  return response.json()
}

export const api = {
  experiments: {
    list: () => fetchApi<Experiment[]>('/experiments'),
    get: (id: string) => fetchApi<Experiment>(`/experiments/${id}`),
    create: (data: CreateExperimentDto) =>
      fetchApi<Experiment>('/experiments', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchApi<void>(`/experiments/${id}`, { method: 'DELETE' }),
  },
  research: {
    start: (mode: string) =>
      fetchApi<{ experimentId: string }>('/research/start', {
        method: 'POST',
        body: JSON.stringify({ mode }),
      }),
    stop: () => fetchApi<void>('/research/stop', { method: 'POST' }),
    getConfig: () => fetchApi<ResearchConfig>('/research/config'),
    updateConfig: (mode: string) =>
      fetchApi<ResearchConfig>('/research/config', {
        method: 'PUT',
        body: JSON.stringify({ mode }),
      }),
  },
}

export interface Experiment {
  id: string
  name: string
  mode: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  metrics: {
    loss?: number
    accuracy?: number
    learningRate?: number
    epoch?: number
  }
  createdAt: string
  completedAt?: string
}

export interface CreateExperimentDto {
  name: string
  mode: string
  config?: Record<string, unknown>
}

export interface ResearchConfig {
  mode: string
  parameters: Record<string, unknown>
}
