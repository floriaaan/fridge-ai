import { HttpFridgeConnector } from '../src/infrastructure/http/http-fridge-connector.js'
import { FakeFridgeConnector } from '../src/infrastructure/fake/fake-fridge-connector.js'
import type { FridgeConnector } from '../src/domain/interfaces/fridge-connector.js'

export function createConnector(): FridgeConnector {
  return process.env.EXPO_PUBLIC_CONNECTOR === 'fake' ? new FakeFridgeConnector() : new HttpFridgeConnector()
}
