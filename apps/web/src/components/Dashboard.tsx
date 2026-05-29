'use client'

import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts'
import { useAppSelector, useAppDispatch } from '@/store/hooks'
import { fetchExperiments } from '@/store/experimentsSlice'

export function Dashboard() {
  const dispatch = useAppDispatch()
  const { items: experiments, loading } = useAppSelector((state) => state.experiments)
  const { isRunning } = useAppSelector((state) => state.research)
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    dispatch(fetchExperiments())
  }, [dispatch])

  // Get the current running experiment or most recent
  const currentExp = experiments.find(e => e.status === 'running') || experiments[0]

  // Build chart data from experiments
  const chartData = experiments
    .filter((e) => e.metrics.loss !== undefined)
    .slice(0, 20)
    .map((e, index) => ({
      name: e.metrics.iteration ? `Iter ${e.metrics.iteration}` : `Exp ${index + 1}`,
      loss: e.metrics.loss,
      valLoss: e.metrics.valLoss,
      iteration: e.metrics.iteration || index,
    }))
    .reverse()

  const statsData = {
    totalExperiments: experiments.length,
    completed: experiments.filter((e) => e.status === 'completed').length,
    running: experiments.filter((e) => e.status === 'running').length,
    failed: experiments.filter((e) => e.status === 'failed').length,
    currentLoss: currentExp?.metrics?.loss?.toFixed(4) || '-',
    currentValLoss: currentExp?.metrics?.valLoss?.toFixed(4) || '-',
  }

  if (loading && experiments.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Quick Guide */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="w-full px-4 py-3 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">📚</span>
            <span className="font-medium text-indigo-900 dark:text-indigo-100">
              Quick Guide: Understanding the Dashboard
            </span>
          </div>
          <svg
            className={`w-5 h-5 text-indigo-600 dark:text-indigo-400 transition-transform ${showGuide ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showGuide && (
          <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold text-indigo-900 dark:text-indigo-100">What is Loss?</h4>
                <p className="text-indigo-700 dark:text-indigo-300">
                  Loss measures how wrong the model&apos;s predictions are. Lower is better.
                  Think of it as a &quot;score of mistakes&quot; - we want to minimize it.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-indigo-900 dark:text-indigo-100">Train vs Validation Loss</h4>
                <p className="text-indigo-700 dark:text-indigo-300">
                  <strong>Train loss:</strong> Error on data the model learns from.<br />
                  <strong>Val loss:</strong> Error on unseen data - shows true performance.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold text-indigo-900 dark:text-indigo-100">What is an Iteration?</h4>
                <p className="text-indigo-700 dark:text-indigo-300">
                  One iteration = one batch of data processed. The model sees examples,
                  calculates error, and updates its weights to improve.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-indigo-900 dark:text-indigo-100">What to Look For</h4>
                <p className="text-indigo-700 dark:text-indigo-300">
                  <strong>Good:</strong> Both losses decreasing together.<br />
                  <strong>Overfitting:</strong> Train loss drops but val loss rises.<br />
                  <strong>Converged:</strong> Losses plateau - training is done.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Experiments"
          value={statsData.totalExperiments}
          hint="Number of training runs performed"
        />
        <StatCard
          title="Completed"
          value={statsData.completed}
          color="green"
          hint="Successfully finished experiments"
        />
        <StatCard
          title="Train Loss"
          value={statsData.currentLoss}
          color={isRunning ? 'blue' : 'gray'}
          pulse={isRunning}
          hint="Error on training data (lower = better)"
        />
        <StatCard
          title="Val Loss"
          value={statsData.currentValLoss}
          color={isRunning ? 'purple' : 'gray'}
          pulse={isRunning}
          hint="Error on unseen data (true performance)"
        />
      </div>

      {/* Current Experiment Info */}
      {currentExp && isRunning && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                Training in Progress
              </span>
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                {currentExp.name}
              </h3>
              <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">
                The model is learning patterns from Shakespeare text, updating weights each iteration
              </p>
            </div>
            <div className="text-right">
              {currentExp.metrics.iteration && (
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  Iter {currentExp.metrics.iteration}
                </div>
              )}
              {currentExp.metrics.parameters && (
                <div className="text-sm text-blue-600 dark:text-blue-400">
                  {currentExp.metrics.parameters}M params
                </div>
              )}
              {currentExp.metrics.learningRate && (
                <div className="text-xs text-blue-500 dark:text-blue-400">
                  LR: {currentExp.metrics.learningRate}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loss Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Training Progress
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Compares training loss (blue) vs validation loss (green) over iterations.
            When both decrease together, the model is learning well.
            If val loss increases while train loss decreases, the model is overfitting.
          </p>
        </div>
        <div className="h-64">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
                <YAxis stroke="#9CA3AF" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#F3F4F6',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="loss"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6', r: 3 }}
                  name="Train Loss"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="valLoss"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ fill: '#10B981', r: 3 }}
                  name="Val Loss"
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
              No training data yet. Start an experiment to see progress.
            </div>
          )}
        </div>
      </div>

      {/* Loss Over Time Area Chart */}
      {chartData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Loss Trend
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Overall trend of training loss over time. The shaded area shows how the model&apos;s
              error decreases as it learns. A steep decline means fast learning;
              a plateau may indicate the model has converged or needs tuning.
            </p>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="iteration" stroke="#9CA3AF" fontSize={12} />
                <YAxis stroke="#9CA3AF" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#F3F4F6',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="loss"
                  stroke="#3B82F6"
                  fill="#3B82F6"
                  fillOpacity={0.2}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  title,
  value,
  color = 'gray',
  pulse = false,
  hint,
}: {
  title: string
  value: string | number
  color?: 'gray' | 'green' | 'blue' | 'purple'
  pulse?: boolean
  hint?: string
}) {
  const colorClasses = {
    gray: 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white',
    green: 'bg-green-100 dark:bg-green-900/50 text-green-900 dark:text-green-100',
    blue: 'bg-blue-100 dark:bg-blue-900/50 text-blue-900 dark:text-blue-100',
    purple: 'bg-purple-100 dark:bg-purple-900/50 text-purple-900 dark:text-purple-100',
  }

  return (
    <div className={`rounded-lg p-4 ${colorClasses[color]} ${pulse ? 'animate-pulse' : ''}`}>
      <p className="text-sm opacity-80">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
      {hint && (
        <p className="text-xs opacity-60 mt-1">{hint}</p>
      )}
    </div>
  )
}
