/**
 * Thin RevenueCat wrapper — the only file that imports `react-native-purchases`.
 * Every export no-ops (rather than throwing) when the native module isn't
 * linked: Expo Go can never load it (no custom native code), and until a dev
 * client/EAS build exists locally neither can a plain `expo start`. Callers
 * never need to know which case they're in.
 *
 * `app_user_id` sent to RevenueCat = the household id (cf. ADR 0014) — one
 * subscription per foyer, not per member.
 */
import Constants, { ExecutionEnvironment } from 'expo-constants'

const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? ''

// `storeClient` = Expo Go. `bare`/`standalone` both carry real native modules
// (dev client and production builds alike).
export function isPurchasesAvailable(): boolean {
  return Constants.executionEnvironment !== ExecutionEnvironment.StoreClient && REVENUECAT_API_KEY.length > 0
}

async function loadPurchases() {
  if (!isPurchasesAvailable()) return null
  try {
    const module = await import('react-native-purchases')
    return module.default
  } catch {
    // Dependency not installed yet, or native module missing from this build.
    return null
  }
}

let configured = false

/** Call once per app session, before `logInHousehold`. */
export async function initPurchases(): Promise<void> {
  const Purchases = await loadPurchases()
  if (!Purchases || configured) return
  Purchases.configure({ apiKey: REVENUECAT_API_KEY })
  configured = true
}

export async function logInHousehold(householdId: string, payerUserId: string): Promise<void> {
  const Purchases = await loadPurchases()
  if (!Purchases) return
  await Purchases.logIn(householdId)
  // Read back by the webhook (`subscriber_attributes.user_id`) to know which
  // member is the payer, for the "payer leaves → revoke" flow (ADR 0014).
  await Purchases.setAttributes({ user_id: payerUserId })
}

export type PurchaseResult = { ok: true } | { ok: false; reason: 'unavailable' | 'cancelled' | 'error'; message?: string }

/** Buys the single AI-plan package of the default offering. Configure that offering/package in the RevenueCat dashboard — not this app's concern. */
export async function purchaseAiPlan(): Promise<PurchaseResult> {
  const Purchases = await loadPurchases()
  if (!Purchases) return { ok: false, reason: 'unavailable' }
  try {
    const offerings = await Purchases.getOfferings()
    const pkg = offerings.current?.availablePackages[0]
    if (!pkg) return { ok: false, reason: 'error', message: 'Aucune offre disponible.' }
    await Purchases.purchasePackage(pkg)
    return { ok: true }
  } catch (error) {
    const userCancelled = (error as { userCancelled?: boolean } | null)?.userCancelled
    if (userCancelled) return { ok: false, reason: 'cancelled' }
    return { ok: false, reason: 'error', message: error instanceof Error ? error.message : String(error) }
  }
}

export async function restorePurchases(): Promise<PurchaseResult> {
  const Purchases = await loadPurchases()
  if (!Purchases) return { ok: false, reason: 'unavailable' }
  try {
    await Purchases.restorePurchases()
    return { ok: true }
  } catch (error) {
    return { ok: false, reason: 'error', message: error instanceof Error ? error.message : String(error) }
  }
}
