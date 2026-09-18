#!/usr/bin/env node
/**
 * Interactive local stand-in for RevenueCat's webhook — hits
 * POST /api/webhooks/revenuecat exactly as RevenueCat would, so the
 * abonnement flow (household_subscription upsert, quota unlock) can be
 * exercised without a real store purchase.
 *
 * Usage: node bin/simulate-revenuecat-webhook.js
 * (needs the backend running with INSTANCE_MODE=hosted and
 * REVENUECAT_WEBHOOK_SECRET set — same value on both sides.)
 */
import { createInterface } from 'node:readline/promises'

const rl = createInterface({ input: process.stdin, output: process.stdout })

async function ask(question, fallback) {
  const suffix = fallback ? ` (${fallback})` : ''
  const answer = (await rl.question(`${question}${suffix}: `)).trim()
  return answer || fallback
}

const SCENARIOS = {
  1: {
    label: 'Achat réussi (INITIAL_PURCHASE) — abonnement actif 30 jours',
    build: (householdId, payerUserId) => ({
      type: 'INITIAL_PURCHASE',
      app_user_id: householdId,
      store: 'APP_STORE',
      expiration_at_ms: Date.now() + 30 * 24 * 60 * 60 * 1000,
      subscriber_attributes: payerUserId ? { user_id: { value: payerUserId } } : undefined,
    }),
  },
  2: {
    label: 'Renouvellement (RENEWAL) — repousse expiration de 30 jours',
    build: (householdId, payerUserId) => ({
      type: 'RENEWAL',
      app_user_id: householdId,
      store: 'APP_STORE',
      expiration_at_ms: Date.now() + 30 * 24 * 60 * 60 * 1000,
      subscriber_attributes: payerUserId ? { user_id: { value: payerUserId } } : undefined,
    }),
  },
  3: {
    label: 'Échec de paiement (BILLING_ISSUE) — expiration inchangée mais imminente',
    build: (householdId, payerUserId) => ({
      type: 'BILLING_ISSUE',
      app_user_id: householdId,
      store: 'APP_STORE',
      expiration_at_ms: Date.now() + 3 * 24 * 60 * 60 * 1000,
      subscriber_attributes: payerUserId ? { user_id: { value: payerUserId } } : undefined,
    }),
  },
  4: {
    label: 'Expiration (EXPIRATION) — coupe l’accès immédiatement',
    build: (householdId) => ({
      type: 'EXPIRATION',
      app_user_id: householdId,
      store: 'APP_STORE',
      expiration_at_ms: Date.now() - 1000,
    }),
  },
  5: {
    label: 'Foyer inconnu — doit être ignoré (200, pas de crash)',
    build: () => ({
      type: 'RENEWAL',
      app_user_id: 'h_does_not_exist',
      store: 'APP_STORE',
      expiration_at_ms: Date.now() + 30 * 24 * 60 * 60 * 1000,
    }),
  },
}

async function main() {
  console.log('Simulateur de webhook RevenueCat\n')

  const apiUrl = await ask('URL du backend', 'http://localhost:3333')
  const secret = await ask('REVENUECAT_WEBHOOK_SECRET', process.env.REVENUECAT_WEBHOOK_SECRET)
  if (!secret) {
    console.error('Un secret est requis (le backend refuse toute requête sans lui).')
    rl.close()
    process.exitCode = 1
    return
  }

  console.log('\nScénarios :')
  for (const [key, { label }] of Object.entries(SCENARIOS)) console.log(`  ${key}. ${label}`)
  const choice = await ask('Choix', '1')
  const scenario = SCENARIOS[choice]
  if (!scenario) {
    console.error(`Scénario "${choice}" inconnu.`)
    rl.close()
    process.exitCode = 1
    return
  }

  const householdId = await ask('household_id (app_user_id)', 'h_test')
  const payerUserId = await ask('payer_user_id (optionnel)', '')

  const event = scenario.build(householdId, payerUserId || undefined)
  rl.close()

  console.log('\nEnvoi →', JSON.stringify(event, null, 2))

  const response = await fetch(`${apiUrl}/api/webhooks/revenuecat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
    body: JSON.stringify({ event }),
  })
  const body = await response.text()
  console.log(`\n← ${response.status} ${response.statusText}`)
  console.log(body)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
