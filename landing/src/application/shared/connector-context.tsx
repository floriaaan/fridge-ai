import { createContext, useContext, type ReactNode } from 'react'
import type { LandingConnector } from '../../domain/interfaces/landing-connector.js'

const ConnectorContext = createContext<LandingConnector | null>(null)

export function ConnectorProvider({
  connector,
  children,
}: {
  connector: LandingConnector
  children: ReactNode
}) {
  return <ConnectorContext.Provider value={connector}>{children}</ConnectorContext.Provider>
}

export function useConnector(): LandingConnector {
  const connector = useContext(ConnectorContext)
  if (!connector) throw new Error('useConnector() called outside <ConnectorProvider>')
  return connector
}
