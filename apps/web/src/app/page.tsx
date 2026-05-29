'use client'

import { Dashboard } from '@/components/Dashboard'
import { Header } from '@/components/Header'
import { ResearchPanel } from '@/components/ResearchPanel'
import { ExperimentsTable } from '@/components/ExperimentsTable'
import { LogsPanel } from '@/components/LogsPanel'
import { SettingsPanel } from '@/components/SettingsPanel'
import { ModelTester } from '@/components/ModelTester'
import { DatasetManager } from '@/components/DatasetManager'
import { AutoresearchPanel } from '@/components/AutoresearchPanel'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <SettingsPanel />
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Dashboard />
          </div>
          <div className="lg:col-span-1">
            <ResearchPanel />
          </div>
        </div>
        {/* Model Testing Section */}
        <div className="mt-6">
          <ModelTester />
        </div>

        {/* Dataset Manager */}
        <div className="mt-6">
          <DatasetManager />
        </div>

        {/* Autoresearch Agent */}
        <div className="mt-6">
          <AutoresearchPanel />
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ExperimentsTable />
          <LogsPanel />
        </div>
      </div>
    </main>
  )
}
