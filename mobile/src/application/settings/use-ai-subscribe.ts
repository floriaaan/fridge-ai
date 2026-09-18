import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAiSettingsQuery } from './ai-settings.query.js'
import { useHouseholdQuery } from '../identity/household.query.js'
import { useSessionQuery } from '../identity/session.query.js'
import { initPurchases, logInHousehold, purchaseAiPlan } from './ai-purchases.js'

/** The subscribe flow every paywall shares; `canSubscribe` is true only on the official instance, on the free plan. */
export function useAiSubscribe() {
  const settings = useAiSettingsQuery()
  const household = useHouseholdQuery()
  const session = useSessionQuery()
  const queryClient = useQueryClient()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubscribe = settings.data?.access.plan === 'free'

  async function subscribe() {
    if (!household.data || !session.data) return
    setError(null)
    setPending(true)
    await initPurchases()
    await logInHousehold(household.data.id, session.data.user.id)
    const result = await purchaseAiPlan()
    setPending(false)
    if (result.ok) {
      queryClient.invalidateQueries({ queryKey: ['ai-settings'] })
    } else if (result.reason === 'unavailable') {
      setError('Abonnement indisponible depuis cette version de l’app (build de développement requis).')
    } else if (result.reason === 'error') {
      setError(result.message ?? 'Échec de l’abonnement.')
    }
  }

  return { canSubscribe, subscribe, pending, error }
}
