'use client'

import { useEffect } from 'react'
import { useAppDispatch } from '@/store/hooks'
import { addLog, setRunning } from '@/store/researchSlice'
import { addExperiment, updateExperiment } from '@/store/experimentsSlice'
import { getSocket } from '@/lib/socket'

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch()

  useEffect(() => {
    const socket = getSocket()

    // Log messages
    socket.on('log', (message: string) => {
      console.log('Log:', message)
      dispatch(addLog(message))
    })

    // Experiment created
    socket.on('experiment:created', (experiment) => {
      console.log('Experiment created:', experiment)
      dispatch(addExperiment(experiment))
    })

    // Experiment updated
    socket.on('experiment:updated', (experiment) => {
      console.log('Experiment updated:', experiment)
      dispatch(updateExperiment(experiment))
    })

    // Research started
    socket.on('research:started', (data) => {
      console.log('Research started:', data)
      dispatch(setRunning(true))
    })

    // Research stopped
    socket.on('research:stopped', () => {
      console.log('Research stopped')
      dispatch(setRunning(false))
    })

    return () => {
      socket.off('log')
      socket.off('experiment:created')
      socket.off('experiment:updated')
      socket.off('research:started')
      socket.off('research:stopped')
    }
  }, [dispatch])

  return <>{children}</>
}
