'use client'

import { useAppSelector, useAppDispatch } from '@/store/hooks'
import { setMode, startResearch, stopResearch, ResearchMode } from '@/store/researchSlice'

export function ResearchPanel() {
  const dispatch = useAppDispatch()
  const { currentMode, availableModes, isRunning, loading } = useAppSelector(
    (state) => state.research
  )

  const handleModeChange = (mode: ResearchMode) => {
    if (!isRunning) {
      dispatch(setMode(mode))
    }
  }

  const handleStartStop = () => {
    if (isRunning) {
      dispatch(stopResearch())
    } else {
      dispatch(startResearch(currentMode))
    }
  }

  const getModeLabel = (mode: string) => {
    if (mode === 'custom') return 'Real Training'
    return mode.charAt(0).toUpperCase() + mode.slice(1)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Research Configuration
      </h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Research Mode
          </label>
          <div className="space-y-2">
            {availableModes.map((config) => (
              <button
                key={config.mode}
                onClick={() => handleModeChange(config.mode)}
                disabled={isRunning}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  currentMode === config.mode
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                } ${isRunning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {getModeLabel(config.mode)}
                  </span>
                  {currentMode === config.mode && (
                    <span className="text-primary-600 dark:text-primary-400 text-sm">
                      Selected
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {config.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleStartStop}
          disabled={loading}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
            isRunning
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-primary-600 hover:bg-primary-700 text-white'
          } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Processing...
            </span>
          ) : isRunning ? (
            'Stop Research'
          ) : (
            'Start Research'
          )}
        </button>
      </div>
    </div>
  )
}
