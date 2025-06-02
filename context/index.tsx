// context/index.tsx
'use client'

import { wagmiAdapter, projectId } from '@/config'
import { createAppKit } from '@reown/appkit/react' 
import { monadTestnet } from '@reown/appkit/networks'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ReactNode } from 'react'
import { cookieToInitialState, WagmiProvider, type Config } from 'wagmi'

const queryClient = new QueryClient()

if (!projectId) {
  throw new Error('Project ID is not defined')
}

const metadata = {
  name: "appkit-example-monad",
  description: "AppKit Example - Monad",
  url: "https://monad-app.com",
  icons: ["https://avatars.githubusercontent.com/u/179229932"]
}

const modal = createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks: [monadTestnet],
  metadata,
  features: {
    analytics: false,
    socials: false,
    email: false
  },
  themeMode: 'dark'
})

function ContextProvider({ children, cookies }: { children: ReactNode; cookies: string | null }) {
  const initialState = cookieToInitialState(wagmiAdapter.wagmiConfig as Config, cookies)

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig as Config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}

export default ContextProvider