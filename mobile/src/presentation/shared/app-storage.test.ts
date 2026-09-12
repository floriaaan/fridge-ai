// mobile/src/presentation/shared/app-storage.test.ts
import * as SecureStore from 'expo-secure-store'
import { telemetry } from '../../infrastructure/telemetry/telemetry.js'
import { configureTelemetry } from '../../application/shared/telemetry.js'
import { readSetting, writeSetting, clearSetting } from './app-storage.js'

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

// `app-storage.ts` reaches telemetry through `getTelemetry()` (presentation
// may not import `infrastructure/telemetry` directly — the boundary lint
// enforces it); wiring the real singleton in here is what `providers/wire-telemetry.ts`
// does for the app itself, so `jest.spyOn(telemetry, ...)` below still spies
// on the instance `getTelemetry()` actually returns.
configureTelemetry(telemetry)

afterEach(() => {
  jest.clearAllMocks()
})

test('readSetting() records telemetry and returns null when SecureStore throws', async () => {
  ;(SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('keychain locked'))
  const spy = jest.spyOn(telemetry, 'recordError').mockImplementation(() => {})

  const result = await readSetting('onboarding_tour_seen')

  expect(result).toBeNull()
  expect(spy).toHaveBeenCalledWith(
    'local storage read failed',
    expect.objectContaining({
      attributes: { 'app.operation': 'storage.read', 'app.storage_key': 'onboarding_tour_seen' },
    }),
  )
  spy.mockRestore()
})

test('writeSetting() records telemetry but does not throw when SecureStore throws', async () => {
  ;(SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('keychain locked'))
  const spy = jest.spyOn(telemetry, 'recordError').mockImplementation(() => {})

  await expect(writeSetting('onboarding_tour_seen', 'true')).resolves.toBeUndefined()

  expect(spy).toHaveBeenCalledWith(
    'local storage write failed',
    expect.objectContaining({
      attributes: { 'app.operation': 'storage.write', 'app.storage_key': 'onboarding_tour_seen' },
    }),
  )
  spy.mockRestore()
})

test('clearSetting() records telemetry but does not throw when SecureStore throws', async () => {
  ;(SecureStore.deleteItemAsync as jest.Mock).mockRejectedValue(new Error('keychain locked'))
  const spy = jest.spyOn(telemetry, 'recordError').mockImplementation(() => {})

  await expect(clearSetting('onboarding_tour_seen')).resolves.toBeUndefined()

  expect(spy).toHaveBeenCalledWith(
    'local storage clear failed',
    expect.objectContaining({
      attributes: { 'app.operation': 'storage.clear', 'app.storage_key': 'onboarding_tour_seen' },
    }),
  )
  spy.mockRestore()
})
