import { useState } from 'react'
import * as WebBrowser from 'expo-web-browser'
import { useQueryClient } from '@tanstack/react-query'
import { useAiSettingsQuery } from './ai-settings.query.js'
import { useConnector } from '../shared/connector-context.js'
import type { Result } from '../../domain/shared/result.js'
import type { ApiError } from '../../domain/shared/api-error.js'

/**
 * The subscribe/manage flow every paywall shares (ADR 0015): the backend hands
 * back a Stripe-hosted page, opened in the system browser. `canSubscribe` is
 * true only on the official instance, on the free plan.
 */
export function useAiSubscribe() {
  const settings = useAiSettingsQuery()
  const connector = useConnector()
  const queryClient = useQueryClient()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubscribe = settings.data?.access.plan === 'free'

  async function openStripePage(start: () => Promise<Result<{ url: string }, ApiError>>) {
    setError(null)
    setPending(true)
    const result = await start()
    if (!result.ok) {
      setPending(false)
      setError(result.error.message || 'Échec de l’ouverture de la page de paiement.')
      return
    }
    // Resolves once the user closes the browser: Stripe redirects to a web page, not back into the app.
    await WebBrowser.openBrowserAsync(result.value.url)
    setPending(false)
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['ai-settings'] })
    refresh()
    // The Stripe webhook that flips the plan can land a moment after the browser closes.
    setTimeout(refresh, 3000)
  }

  return {
    canSubscribe,
    subscribe: () => openStripePage(() => connector.startSubscriptionCheckout()),
    manage: () => openStripePage(() => connector.openBillingPortal()),
    pending,
    error,
  }
}
