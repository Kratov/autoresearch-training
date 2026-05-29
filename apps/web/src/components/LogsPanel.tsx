'use client'

import { useEffect, useRef, useState } from 'react'
import { useAppSelector, useAppDispatch } from '@/store/hooks'
import { clearLogs } from '@/store/researchSlice'
import dynamic from 'next/dynamic'

// Dynamically import Monaco to avoid SSR issues
const Editor = dynamic(() => import('@monaco-editor/react').then(mod => mod.default), {
  ssr: false,
  loading: () => (
    <div className="h-80 bg-gray-900 flex items-center justify-center text-gray-500">
      Loading editor...
    </div>
  ),
})

export function LogsPanel() {
  const dispatch = useAppDispatch()
  const { logs, isRunning } = useAppSelector((state) => state.research)
  const [autoScroll, setAutoScroll] = useState(true)
  const editorRef = useRef<unknown>(null)

  // Combine logs into a single string
  const logsText = logs.join('\n')

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (autoScroll && editorRef.current) {
      const editor = editorRef.current as { revealLine: (line: number) => void; getModel: () => { getLineCount: () => number } | null }
      const model = editor.getModel()
      if (model) {
        const lineCount = model.getLineCount()
        editor.revealLine(lineCount)
      }
    }
  }, [logs, autoScroll])

  const handleEditorMount = (editor: unknown) => {
    editorRef.current = editor
  }

  const handleDownload = () => {
    const blob = new Blob([logsText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `experiment-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Experiment Logs
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Real-time training output with syntax highlighting
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {isRunning && (
            <span className="flex items-center text-sm text-green-600 dark:text-green-400">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2" />
              Live
            </span>
          )}
          <label className="flex items-center text-sm text-gray-500 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="mr-1.5 rounded"
            />
            Auto-scroll
          </label>
          <button
            onClick={handleDownload}
            disabled={logs.length === 0}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
            title="Download logs"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
          <button
            onClick={() => dispatch(clearLogs())}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Clear
          </button>
        </div>
      </div>
      <div className="h-80">
        {logs.length === 0 ? (
          <div className="h-full bg-[#1e1e1e] flex items-center justify-center text-gray-500">
            No logs yet. Start a research session to see output.
          </div>
        ) : (
          <Editor
            height="100%"
            defaultLanguage="log"
            value={logsText}
            theme="vs-dark"
            onMount={handleEditorMount}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 12,
              fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
              lineNumbers: 'on',
              wordWrap: 'on',
              automaticLayout: true,
              scrollbar: {
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8,
              },
              renderLineHighlight: 'none',
              overviewRulerBorder: false,
              hideCursorInOverviewRuler: true,
              contextmenu: true,
              folding: false,
              glyphMargin: false,
            }}
          />
        )}
      </div>
    </div>
  )
}
