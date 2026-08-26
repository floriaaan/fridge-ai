import { createContext, useContext, type ReactNode } from 'react'
import type { FridgeConnector } from '../../domain/interfaces/fridge-connector.js'

const ConnectorContext = createContext<FridgeConnector | null>(null)

export function ConnectorProvider({
  connector,
  children,
}: {
  connector: FridgeConnector
  children: ReactNode
}) {
  return <ConnectorContext.Provider value={connector}>{children}</ConnectorContext.Provider>
}

export function useConnector(): FridgeConnector {
  const connector = useContext(ConnectorContext)
  if (!connector) throw new Error('useConnector() called outside <ConnectorProvider>')
  return connector
}
