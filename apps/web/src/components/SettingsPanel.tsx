'use client'

import { useEffect, useState } from 'react'
import { useAppSelector, useAppDispatch } from '@/store/hooks'
import {
  fetchSettings,
  updateSettings,
  applyPreset,
  resetSettings,
  closeSettings,
  setLocalSetting,
  TrainingSettings,
} from '@/store/settingsSlice'
import { clearAllExperiments } from '@/store/experimentsSlice'
import { clearLogs } from '@/store/researchSlice'

const SETTING_INFO: Record<keyof TrainingSettings, { label: string; hint: string; category: string }> = {
  n_layer: {
    label: 'Layers',
    hint: 'Number of transformer blocks stacked. More layers = deeper model, can learn more complex patterns but slower to train.',
    category: 'architecture',
  },
  n_head: {
    label: 'Attention Heads',
    hint: 'Parallel attention patterns. Each head can focus on different aspects of the input (grammar, meaning, etc).',
    category: 'architecture',
  },
  n_embd: {
    label: 'Embedding Dimension',
    hint: 'Size of token vectors. Larger = more capacity to represent meaning, but uses more memory.',
    category: 'architecture',
  },
  block_size: {
    label: 'Context Length',
    hint: 'How many tokens the model can "see" at once. Longer context = better understanding but more memory.',
    category: 'architecture',
  },
  dropout: {
    label: 'Dropout Rate',
    hint: 'Randomly ignores neurons during training to prevent overfitting. 0.1-0.2 is typical.',
    category: 'architecture',
  },
  learning_rate: {
    label: 'Learning Rate',
    hint: 'How big each weight update is. Too high = unstable, too low = slow training. 3e-4 is a good default.',
    category: 'training',
  },
  batch_size: {
    label: 'Batch Size',
    hint: 'Samples processed together. Larger = more stable gradients but needs more GPU memory.',
    category: 'training',
  },
  max_iters: {
    label: 'Training Steps',
    hint: 'Total number of weight updates. More steps = better results but longer training.',
    category: 'training',
  },
  eval_interval: {
    label: 'Eval Frequency',
    hint: 'How often to check validation loss. Lower = more frequent updates in the UI.',
    category: 'training',
  },
  optimizer: {
    label: 'Optimizer',
    hint: 'Algorithm for updating weights. AdamW is the standard choice for transformers.',
    category: 'optimizer',
  },
  weight_decay: {
    label: 'Weight Decay',
    hint: 'Penalizes large weights to prevent overfitting. 0.1 is typical for AdamW.',
    category: 'optimizer',
  },
  beta1: {
    label: 'Beta1 (Momentum)',
    hint: 'How much to consider past gradients. 0.9 means 90% old direction, 10% new.',
    category: 'optimizer',
  },
  beta2: {
    label: 'Beta2 (RMSprop)',
    hint: 'Smoothing for gradient magnitude. Helps with noisy gradients. 0.99 is typical.',
    category: 'optimizer',
  },
  autoImprove: {
    label: 'Auto-Improve Mode',
    hint: 'When enabled, automatically runs experiments with progressively optimized hyperparameters.',
    category: 'mode',
  },
  dataset: {
    label: 'Dataset',
    hint: 'Text dataset to train the model on. Different datasets produce different styles.',
    category: 'data',
  },
}

const PRESET_INFO: Record<string, { label: string; description: string; time: string }> = {
  tiny: {
    label: 'Tiny',
    description: 'Minimal model for quick testing',
    time: '~30 sec',
  },
  fast_demo: {
    label: 'Fast Demo',
    description: 'Quick demo with decent results',
    time: '~1 min',
  },
  balanced: {
    label: 'Balanced',
    description: 'Good quality vs speed tradeoff',
    time: '~2-3 min',
  },
  high_quality: {
    label: 'High Quality',
    description: 'Better results, longer training',
    time: '~5-7 min',
  },
}

interface Dataset {
  id: string
  name: string
  description: string
  downloaded: boolean
}

export function SettingsPanel() {
  const dispatch = useAppDispatch()
  const { settings, presets, isOpen, loading } = useAppSelector((state) => state.settings)
  const { isRunning } = useAppSelector((state) => state.research)
  const { items: experiments } = useAppSelector((state) => state.experiments)
  const [isClearing, setIsClearing] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [datasets, setDatasets] = useState<Dataset[]>([])

  useEffect(() => {
    dispatch(fetchSettings())
    // Fetch available datasets
    const fetchDatasets = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
        const response = await fetch(`${API_URL}/api/datasets`)
        const data = await response.json()
        setDatasets(data.datasets || [])
      } catch (error) {
        console.error('Failed to fetch datasets:', error)
      }
    }
    fetchDatasets()
  }, [dispatch])

  if (!isOpen) return null

  const handleChange = (key: keyof TrainingSettings, value: string | boolean) => {
    if (typeof value === 'boolean') {
      dispatch(setLocalSetting({ key, value }))
    } else {
      const numValue = parseFloat(value)
      if (!isNaN(numValue)) {
        dispatch(setLocalSetting({ key, value: numValue }))
      } else {
        dispatch(setLocalSetting({ key, value }))
      }
    }
  }

  const handleSave = () => {
    dispatch(updateSettings(settings))
    dispatch(closeSettings())
  }

  const handlePreset = (preset: string) => {
    dispatch(applyPreset(preset))
  }

  const handleReset = () => {
    dispatch(resetSettings())
  }

  const handleClearExperiments = async () => {
    setIsClearing(true)
    try {
      await dispatch(clearAllExperiments()).unwrap()
      dispatch(clearLogs())
      // Also reset the optimizer
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
      await fetch(`${API_URL}/api/research/reset-optimizer`, { method: 'POST' })
      setShowClearConfirm(false)
    } finally {
      setIsClearing(false)
    }
  }

  const handleAutoImproveToggle = () => {
    dispatch(setLocalSetting({ key: 'autoImprove', value: !settings.autoImprove }))
  }

  // Calculate estimated params
  const estimatedParams = (
    (settings.n_layer * settings.n_head * settings.n_embd * settings.n_embd * 4) / 1e6
  ).toFixed(1)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Training Settings
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Configure hyperparameters for your experiment
            </p>
          </div>
          <button
            onClick={() => dispatch(closeSettings())}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Presets */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-3">
              Quick Presets
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(PRESET_INFO).map(([key, info]) => (
                <button
                  key={key}
                  onClick={() => handlePreset(key)}
                  disabled={isRunning}
                  className="p-3 text-left rounded-lg border border-gray-200 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="font-medium text-gray-900 dark:text-white">{info.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{info.description}</div>
                  <div className="text-xs text-primary-600 dark:text-primary-400 mt-1">{info.time}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Model Stats */}
          <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">Estimated Model Size</span>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">{estimatedParams}M params</span>
            </div>
          </div>

          {/* Dataset Selection */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-3">
              Training Dataset
            </h3>
            <div className="space-y-3">
              <select
                value={settings.dataset}
                onChange={(e) => handleChange('dataset', e.target.value)}
                disabled={isRunning}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
              >
                {datasets.filter(d => d.downloaded).map((dataset) => (
                  <option key={dataset.id} value={dataset.id}>
                    {dataset.name}
                  </option>
                ))}
                {datasets.filter(d => d.downloaded).length === 0 && (
                  <option value="shakespeare">Shakespeare (default)</option>
                )}
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {SETTING_INFO.dataset.hint} Use the Dataset Manager below to download or upload datasets.
              </p>
            </div>
          </div>

          {/* Training Mode & Demo Reset */}
          <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Auto-Improve Toggle */}
            <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Auto-Improve Mode</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Automatically optimize hyperparameters between runs
                  </p>
                </div>
                <button
                  onClick={handleAutoImproveToggle}
                  disabled={isRunning}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                    settings.autoImprove ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.autoImprove ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {settings.autoImprove && (
                <div className="mt-3 p-2 bg-primary-50 dark:bg-primary-900/20 rounded text-xs text-primary-700 dark:text-primary-300">
                  System will use Bayesian optimization to find better hyperparameters after each run.
                </div>
              )}
            </div>

            {/* Clear Experiments */}
            <div className="p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-red-900 dark:text-red-100">Reset Experiments</h4>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    Clear all {experiments.length} experiments for a fresh demo
                  </p>
                </div>
                {!showClearConfirm ? (
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    disabled={isRunning || experiments.length === 0}
                    className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Clear All
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleClearExperiments}
                      disabled={isClearing}
                      className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50"
                    >
                      {isClearing ? 'Clearing...' : 'Confirm'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Model Architecture */}
          <SettingsSection title="Model Architecture" description="Define the structure of the transformer">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SettingInput
                settingKey="n_layer"
                value={settings.n_layer}
                onChange={handleChange}
                min={1}
                max={24}
                disabled={isRunning}
              />
              <SettingInput
                settingKey="n_head"
                value={settings.n_head}
                onChange={handleChange}
                min={1}
                max={16}
                disabled={isRunning}
              />
              <SettingInput
                settingKey="n_embd"
                value={settings.n_embd}
                onChange={handleChange}
                min={64}
                max={1024}
                step={64}
                disabled={isRunning}
              />
              <SettingInput
                settingKey="block_size"
                value={settings.block_size}
                onChange={handleChange}
                min={32}
                max={1024}
                step={32}
                disabled={isRunning}
              />
              <SettingInput
                settingKey="dropout"
                value={settings.dropout}
                onChange={handleChange}
                min={0}
                max={0.5}
                step={0.05}
                disabled={isRunning}
              />
            </div>
          </SettingsSection>

          {/* Training */}
          <SettingsSection title="Training" description="Control the learning process">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SettingInput
                settingKey="learning_rate"
                value={settings.learning_rate}
                onChange={handleChange}
                min={0.000001}
                max={0.1}
                step={0.0001}
                disabled={isRunning}
              />
              <SettingInput
                settingKey="batch_size"
                value={settings.batch_size}
                onChange={handleChange}
                min={1}
                max={256}
                disabled={isRunning}
              />
              <SettingInput
                settingKey="max_iters"
                value={settings.max_iters}
                onChange={handleChange}
                min={10}
                max={10000}
                step={50}
                disabled={isRunning}
              />
              <SettingInput
                settingKey="eval_interval"
                value={settings.eval_interval}
                onChange={handleChange}
                min={5}
                max={500}
                step={5}
                disabled={isRunning}
              />
            </div>
          </SettingsSection>

          {/* Optimizer */}
          <SettingsSection title="Optimizer" description="Algorithm for updating model weights">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {SETTING_INFO.optimizer.label}
                </label>
                <select
                  value={settings.optimizer}
                  onChange={(e) => handleChange('optimizer', e.target.value)}
                  disabled={isRunning}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                >
                  <option value="adamw">AdamW (Recommended)</option>
                  <option value="adam">Adam</option>
                  <option value="sgd">SGD</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {SETTING_INFO.optimizer.hint}
                </p>
              </div>
              <SettingInput
                settingKey="weight_decay"
                value={settings.weight_decay}
                onChange={handleChange}
                min={0}
                max={1}
                step={0.01}
                disabled={isRunning}
              />
              <SettingInput
                settingKey="beta1"
                value={settings.beta1}
                onChange={handleChange}
                min={0}
                max={1}
                step={0.01}
                disabled={isRunning}
              />
              <SettingInput
                settingKey="beta2"
                value={settings.beta2}
                onChange={handleChange}
                min={0}
                max={1}
                step={0.01}
                disabled={isRunning}
              />
            </div>
          </SettingsSection>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between bg-gray-50 dark:bg-gray-900">
          <button
            onClick={handleReset}
            disabled={isRunning || loading}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50"
          >
            Reset to Defaults
          </button>
          <div className="space-x-3">
            <button
              onClick={() => dispatch(closeSettings())}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isRunning || loading}
              className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-md disabled:opacity-50"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-8">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
          {title}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      {children}
    </div>
  )
}

function SettingInput({
  settingKey,
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
}: {
  settingKey: keyof TrainingSettings
  value: number
  onChange: (key: keyof TrainingSettings, value: string) => void
  min: number
  max: number
  step?: number
  disabled: boolean
}) {
  const info = SETTING_INFO[settingKey]

  return (
    <div className="group">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {info.label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(settingKey, e.target.value)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      />
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
        {info.hint}
      </p>
    </div>
  )
}
