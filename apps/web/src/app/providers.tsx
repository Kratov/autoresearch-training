'use client'

import { Provider } from 'react-redux'
import { store } from '@/store'
import { SocketProvider } from '@/components/SocketProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <SocketProvider>{children}</SocketProvider>
    </Provider>
  )
}
