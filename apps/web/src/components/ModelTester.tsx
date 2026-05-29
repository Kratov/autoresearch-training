'use client'

import { useState, useEffect } from 'react'
import { useAppSelector } from '@/store/hooks'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export function ModelTester() {
  const { isRunning } = useAppSelector((state) => state.research)
  const [prompt, setPrompt] = useState('')
  const [generatedText, setGeneratedText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasModel, setHasModel] = useState(false)
  const [temperature, setTemperature] = useState(0.8)
  const [maxTokens, setMaxTokens] = useState(200)
  const [context, setContext] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Check if model is available
  useEffect(() => {
    const checkModel = async () => {
      try {
        const response = await fetch(`${API_URL}/api/research/model-status`)
        const data = await response.json()
        setHasModel(data.has_model)
      } catch {
        setHasModel(false)
      }
    }

    checkModel()
    const interval = setInterval(checkModel, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleGenerate = async () => {
    if (isRunning) {
      setError('Cannot generate while training is in progress')
      return
    }

    setIsGenerating(true)
    setError(null)
    setGeneratedText('')

    try {
      const response = await fetch(`${API_URL}/api/research/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt || '\n',
          maxTokens,
          temperature,
          context: context || undefined,
        }),
      })

      const data = await response.json()

      if (data.error) {
        setError(data.error)
      } else {
        setGeneratedText(data.text)
      }
    } catch (err) {
      setError('Failed to generate text. Make sure the worker is running.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <span>Test the Model</span>
          {hasModel ? (
            <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded-full">
              Model Ready
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full">
              No Model
            </span>
          )}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Generate Shakespeare-style text from your trained model. Enter a prompt or leave empty for a random start.
        </p>
      </div>

      {/* Input Section */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Prompt (optional)
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter a starting phrase like 'ROMEO:' or 'To be or not to be' or leave empty..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            rows={2}
            disabled={isGenerating || isRunning || !hasModel}
          />
        </div>

        {/* Generation Settings */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Temperature: {temperature}
            </label>
            <input
              type="range"
              min="0.1"
              max="2.0"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full"
              disabled={isGenerating || isRunning || !hasModel}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Lower = more focused, Higher = more creative/random
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Max Tokens: {maxTokens}
            </label>
            <input
              type="range"
              min="50"
              max="500"
              step="50"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value))}
              className="w-full"
              disabled={isGenerating || isRunning || !hasModel}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Length of generated text (in characters)
            </p>
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-md">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full px-3 py-2 flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md"
          >
            <span>Advanced Settings</span>
            <svg
              className={`w-4 h-4 transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showAdvanced && (
            <div className="px-3 pb-3 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Context / Prefix (optional)
                </label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Set a context that will be prepended to your prompt. E.g., a scene setup, character dialogue format, or writing style example..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  rows={4}
                  disabled={isGenerating || isRunning || !hasModel}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  This text will be prepended to your prompt to prime the model with a certain style or context.
                  For example: &quot;ACT I. SCENE I. A desert place...&quot;
                </p>
              </div>

              {/* Preset Contexts */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Quick Presets:
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Romeo & Juliet', value: 'ACT II. SCENE II. Capulet\'s orchard.\n\nEnter ROMEO.\n\nROMEO:\n' },
                    { label: 'Hamlet Soliloquy', value: 'Enter HAMLET.\n\nHAMLET:\nTo be, or not to be, ' },
                    { label: 'Sonnet', value: 'SONNET\n\nShall I compare thee to a summer\'s day?\nThou art more lovely and more temperate:\n' },
                    { label: 'Witches', value: 'Thunder. Enter the three Witches.\n\nFirst Witch:\nWhen shall we three meet again?\nIn thunder, lightning, or in rain?\n\nSecond Witch:\n' },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setContext(preset.value)
                        setPrompt('')
                      }}
                      disabled={isGenerating || isRunning || !hasModel}
                      className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {preset.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setContext('')
                      setPrompt('')
                    }}
                    disabled={isGenerating || isRunning || !hasModel}
                    className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating || isRunning || !hasModel}
          className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Generating...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Generate Text</span>
            </>
          )}
        </button>

        {!hasModel && !isRunning && (
          <p className="text-sm text-amber-600 dark:text-amber-400 text-center">
            Train a model first to enable text generation
          </p>
        )}

        {isRunning && (
          <p className="text-sm text-blue-600 dark:text-blue-400 text-center">
            Model is currently training. Generation will be available after training completes.
          </p>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Generated Text Display */}
      {generatedText && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Generated Text
            </h3>
            <button
              onClick={() => navigator.clipboard.writeText(generatedText)}
              className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
            >
              Copy to clipboard
            </button>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700 font-mono text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap max-h-64 overflow-y-auto">
            {generatedText}
          </div>
        </div>
      )}
    </div>
  )
}
