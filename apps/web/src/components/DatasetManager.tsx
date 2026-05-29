'use client'

import { useState, useEffect, useRef } from 'react'
import { useAppSelector } from '@/store/hooks'
import dynamic from 'next/dynamic'

const Editor = dynamic(() => import('@monaco-editor/react').then(mod => mod.default), {
  ssr: false,
  loading: () => (
    <div className="h-48 bg-gray-900 flex items-center justify-center text-gray-500">
      Loading preview...
    </div>
  ),
})

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Dataset {
  id: string
  name: string
  description: string
  size: string
  source: 'predefined' | 'custom'
  downloaded: boolean
  charCount?: number
}

export function DatasetManager() {
  const { isRunning } = useAppSelector((state) => state.research)
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDataset, setSelectedDataset] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch datasets on mount
  useEffect(() => {
    fetchDatasets()
  }, [])

  const fetchDatasets = async () => {
    try {
      const response = await fetch(`${API_URL}/api/datasets`)
      const data = await response.json()
      setDatasets(data.datasets || [])
    } catch (error) {
      console.error('Failed to fetch datasets:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (datasetId: string) => {
    setActionLoading(datasetId)
    try {
      const response = await fetch(`${API_URL}/api/datasets/download/${datasetId}`, {
        method: 'POST',
      })
      const data = await response.json()
      if (data.error) {
        alert(data.error)
      } else {
        await fetchDatasets()
      }
    } catch (error) {
      alert('Failed to download dataset')
    } finally {
      setActionLoading(null)
    }
  }

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setActionLoading('upload')
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${API_URL}/api/datasets/upload`, {
        method: 'POST',
        body: formData,
      })
      const data = await response.json()
      if (data.error) {
        alert(data.error)
      } else {
        await fetchDatasets()
      }
    } catch (error) {
      alert('Failed to upload dataset')
    } finally {
      setActionLoading(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDelete = async (datasetId: string) => {
    if (!confirm('Are you sure you want to delete this dataset?')) return

    setActionLoading(datasetId)
    try {
      const response = await fetch(`${API_URL}/api/datasets/${datasetId}`, {
        method: 'DELETE',
      })
      const data = await response.json()
      if (data.error) {
        alert(data.error)
      } else {
        await fetchDatasets()
        if (selectedDataset === datasetId) {
          setSelectedDataset(null)
          setPreview(null)
        }
      }
    } catch (error) {
      alert('Failed to delete dataset')
    } finally {
      setActionLoading(null)
    }
  }

  const handlePreview = async (datasetId: string) => {
    if (selectedDataset === datasetId) {
      setSelectedDataset(null)
      setPreview(null)
      return
    }

    setSelectedDataset(datasetId)
    setPreviewLoading(true)
    try {
      const response = await fetch(`${API_URL}/api/datasets/${datasetId}/preview?maxChars=2000`)
      const data = await response.json()
      setPreview(data.preview || data.error || 'No preview available')
    } catch (error) {
      setPreview('Failed to load preview')
    } finally {
      setPreviewLoading(false)
    }
  }

  const predefinedDatasets = datasets.filter(d => d.source === 'predefined')
  const customDatasets = datasets.filter(d => d.source === 'custom')

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between text-left border-b border-gray-200 dark:border-gray-700"
      >
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
            Dataset Manager
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {datasets.filter(d => d.downloaded).length} datasets available
          </p>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Content - Collapsible */}
      {isOpen && (
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading datasets...</div>
          ) : (
            <div className="space-y-6">
              {/* Upload Section */}
              <div className="flex items-center gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt"
                  onChange={handleUpload}
                  className="hidden"
                  id="dataset-upload"
                />
                <label
                  htmlFor="dataset-upload"
                  className={`flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md cursor-pointer ${
                    actionLoading === 'upload' || isRunning ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {actionLoading === 'upload' ? (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  )}
                  Upload Custom Dataset
                </label>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Upload a .txt file to train on your own data
                </span>
              </div>

              {/* Predefined Datasets */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
                  Predefined Datasets
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {predefinedDatasets.map((dataset) => (
                    <DatasetCard
                      key={dataset.id}
                      dataset={dataset}
                      isSelected={selectedDataset === dataset.id}
                      isLoading={actionLoading === dataset.id}
                      isRunning={isRunning}
                      onDownload={() => handleDownload(dataset.id)}
                      onPreview={() => handlePreview(dataset.id)}
                      onDelete={() => {}}
                      canDelete={false}
                    />
                  ))}
                </div>
              </div>

              {/* Custom Datasets */}
              {customDatasets.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
                    Custom Datasets
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {customDatasets.map((dataset) => (
                      <DatasetCard
                        key={dataset.id}
                        dataset={dataset}
                        isSelected={selectedDataset === dataset.id}
                        isLoading={actionLoading === dataset.id}
                        isRunning={isRunning}
                        onDownload={() => {}}
                        onPreview={() => handlePreview(dataset.id)}
                        onDelete={() => handleDelete(dataset.id)}
                        canDelete={true}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Preview Panel */}
              {selectedDataset && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Dataset Preview
                  </h3>
                  {previewLoading ? (
                    <div className="h-48 bg-gray-900 flex items-center justify-center text-gray-500">
                      Loading preview...
                    </div>
                  ) : (
                    <div className="h-48 rounded-md overflow-hidden border border-gray-700">
                      <Editor
                        height="100%"
                        defaultLanguage="plaintext"
                        value={preview || ''}
                        theme="vs-dark"
                        options={{
                          readOnly: true,
                          minimap: { enabled: false },
                          scrollBeyondLastLine: false,
                          fontSize: 12,
                          wordWrap: 'on',
                          lineNumbers: 'off',
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DatasetCard({
  dataset,
  isSelected,
  isLoading,
  isRunning,
  onDownload,
  onPreview,
  onDelete,
  canDelete,
}: {
  dataset: Dataset
  isSelected: boolean
  isLoading: boolean
  isRunning: boolean
  onDownload: () => void
  onPreview: () => void
  onDelete: () => void
  canDelete: boolean
}) {
  return (
    <div
      className={`p-4 rounded-lg border transition-colors ${
        isSelected
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-gray-900 dark:text-white">{dataset.name}</h4>
            {dataset.downloaded ? (
              <span className="text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded">
                Ready
              </span>
            ) : (
              <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded">
                Not downloaded
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{dataset.description}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
            <span>{dataset.size}</span>
            {dataset.charCount && <span>{dataset.charCount.toLocaleString()} chars</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        {!dataset.downloaded ? (
          <button
            onClick={onDownload}
            disabled={isLoading || isRunning}
            className="text-xs px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded disabled:opacity-50"
          >
            {isLoading ? 'Downloading...' : 'Download'}
          </button>
        ) : (
          <>
            <button
              onClick={onPreview}
              className={`text-xs px-3 py-1.5 rounded ${
                isSelected
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {isSelected ? 'Hide Preview' : 'Preview'}
            </button>
            {canDelete && (
              <button
                onClick={onDelete}
                disabled={isLoading || isRunning}
                className="text-xs px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50"
              >
                {isLoading ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
