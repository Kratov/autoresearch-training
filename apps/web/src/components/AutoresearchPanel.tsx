'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

const Editor = dynamic(() => import('@monaco-editor/react').then((mod) => mod.default), {
  ssr: false,
  loading: () => (
    <div className="h-64 bg-gray-900 flex items-center justify-center text-gray-400">
      Loading editor...
    </div>
  ),
})

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface IterationResult {
  iteration: number
  val_loss: number | null
  changes: string
}

interface AutoresearchStatus {
  is_running: boolean
  iteration: number
  best_val_loss: number | null
  history: IterationResult[]
}

export function AutoresearchPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'program' | 'train' | 'history'>('program')
  const [programContent, setProgramContent] = useState('')
  const [trainContent, setTrainContent] = useState('')
  const [status, setStatus] = useState<AutoresearchStatus>({
    is_running: false,
    iteration: 0,
    best_val_loss: null,
    history: [],
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [maxIterations, setMaxIterations] = useState(10)
  const [targetLoss, setTargetLoss] = useState(1.2)

  // Fetch initial data
  useEffect(() => {
    if (isOpen) {
      fetchProgram()
      fetchTrainPy()
      fetchStatus()
    }
  }, [isOpen])

  // Poll status when running
  useEffect(() => {
    if (!status.is_running) return

    const interval = setInterval(fetchStatus, 3000)
    return () => clearInterval(interval)
  }, [status.is_running])

  const fetchProgram = async () => {
    try {
      const res = await fetch(`${API_URL}/api/research/autoresearch/program`)
      const data = await res.json()
      setProgramContent(data.content || '')
    } catch {
      setError('Failed to load program.md')
    }
  }

  const fetchTrainPy = async () => {
    try {
      const res = await fetch(`${API_URL}/api/research/autoresearch/train`)
      const data = await res.json()
      setTrainContent(data.content || '')
    } catch {
      setError('Failed to load train.py')
    }
  }

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/research/autoresearch/status`)
      const data = await res.json()
      setStatus(data)
    } catch {
      // Ignore status fetch errors
    }
  }

  const saveProgram = async () => {
    setIsLoading(true)
    try {
      await fetch(`${API_URL}/api/research/autoresearch/program`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: programContent }),
      })
      setError(null)
    } catch {
      setError('Failed to save program.md')
    } finally {
      setIsLoading(false)
    }
  }

  const startAutoresearch = async () => {
    if (!apiKey) {
      setError('Anthropic API key is required')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_URL}/api/research/autoresearch/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxIterations,
          targetLoss,
          anthropicApiKey: apiKey,
        }),
      })

      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        fetchStatus()
      }
    } catch {
      setError('Failed to start autoresearch')
    } finally {
      setIsLoading(false)
    }
  }

  const stopAutoresearch = async () => {
    setIsLoading(true)
    try {
      await fetch(`${API_URL}/api/research/autoresearch/stop`, {
        method: 'POST',
      })
      fetchStatus()
    } catch {
      setError('Failed to stop autoresearch')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Autoresearch Agent
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              AI-driven iterative improvement of train.py
            </p>
          </div>
          {status.is_running && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-full animate-pulse">
              Running - Iter {status.iteration}
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transform transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="px-6 pb-6 border-t border-gray-200 dark:border-gray-700">
          {/* Status Bar */}
          {status.best_val_loss !== null && (
            <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-md">
              <div className="flex items-center justify-between text-sm">
                <span className="text-purple-700 dark:text-purple-300">
                  Best Validation Loss: <strong>{status.best_val_loss.toFixed(4)}</strong>
                </span>
                <span className="text-purple-600 dark:text-purple-400">
                  Iterations: {status.history.length}
                </span>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Controls */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Anthropic API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={status.is_running}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Max Iterations
              </label>
              <input
                type="number"
                value={maxIterations}
                onChange={(e) => setMaxIterations(parseInt(e.target.value) || 10)}
                min={1}
                max={50}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={status.is_running}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Target Loss
              </label>
              <input
                type="number"
                value={targetLoss}
                onChange={(e) => setTargetLoss(parseFloat(e.target.value) || 1.2)}
                step={0.1}
                min={0.5}
                max={2.0}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={status.is_running}
              />
            </div>
            <div className="flex items-end">
              {status.is_running ? (
                <button
                  onClick={stopAutoresearch}
                  disabled={isLoading}
                  className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50"
                >
                  Stop Agent
                </button>
              ) : (
                <button
                  onClick={startAutoresearch}
                  disabled={isLoading || !apiKey}
                  className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md disabled:opacity-50"
                >
                  Start Agent
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 border-b border-gray-200 dark:border-gray-700">
            <nav className="flex gap-4">
              {(['program', 'train', 'history'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {tab === 'program' && 'program.md'}
                  {tab === 'train' && 'train.py'}
                  {tab === 'history' && `History (${status.history.length})`}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="mt-4">
            {activeTab === 'program' && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Edit the research goals and constraints for the agent
                  </p>
                  <button
                    onClick={saveProgram}
                    disabled={isLoading || status.is_running}
                    className="px-3 py-1 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded disabled:opacity-50"
                  >
                    Save Changes
                  </button>
                </div>
                <div className="h-96 border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden">
                  <Editor
                    height="100%"
                    language="markdown"
                    theme="vs-dark"
                    value={programContent}
                    onChange={(value) => setProgramContent(value || '')}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      wordWrap: 'on',
                      readOnly: status.is_running,
                    }}
                  />
                </div>
              </div>
            )}

            {activeTab === 'train' && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Current train.py (modified by the agent)
                </p>
                <div className="h-96 border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden">
                  <Editor
                    height="100%"
                    language="python"
                    theme="vs-dark"
                    value={trainContent}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      readOnly: true,
                    }}
                  />
                </div>
                <button
                  onClick={fetchTrainPy}
                  className="mt-2 px-3 py-1 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded"
                >
                  Refresh
                </button>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {status.history.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                    No iterations yet. Start the agent to begin research.
                  </p>
                ) : (
                  status.history.map((result, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          Iteration {result.iteration}
                        </span>
                        <span
                          className={`text-sm font-mono ${
                            result.val_loss !== null && result.val_loss <= (status.best_val_loss || Infinity)
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          val_loss: {result.val_loss !== null ? result.val_loss.toFixed(4) : 'Failed'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {result.changes}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
