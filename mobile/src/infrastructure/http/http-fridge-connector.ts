import { authClient } from '../auth/auth-client.js'
import { apiFetch, apiFetchMultipart } from './http-client.js'
import { telemetry } from '../telemetry/telemetry.js'
import { Result } from '../../domain/shared/result.js'
import type { FridgeConnector } from '../../domain/interfaces/fridge-connector.js'
import type { Session } from '../../domain/identity/session.js'
import type { Household } from '../../domain/identity/household.js'
import type { AuthMethod } from '../../domain/identity/auth-method.js'
import type { ApiError } from '../../domain/shared/api-error.js'
import type { ShoppingItem, CreateShoppingItemInput, UpdateShoppingItemInput } from '../../domain/shopping-list/shopping-item.js'
import type { Recipe } from '../../domain/recipe/recipe.js'
import type { Product, CreateProductInput, UpdateProductInput } from '../../domain/fridge/product.js'
import type { LocationValue } from '../../domain/fridge/location.js'
import type { ProductLookupResult } from '../../domain/fridge/product-lookup-result.js'
import type { ReceiptDraft } from '../../domain/receipt/receipt-draft.js'
import type { Receipt, ImportReceiptInput } from '../../domain/receipt/receipt.js'
import type { AiSettings, AiProvider } from '../../domain/settings/ai-settings.js'
import type {
  HaLink,
  HaTodoEntity,
  SaveHaConnectionInput,
  DiscoverHaEntitiesInput,
  BindHaListInput,
} from '../../domain/home-assistant/ha-link.js'

function toSession(
  data: { user: { id: string; email: string; name: string; image?: string | null } } | null | undefined,
): Session | null {
  if (!data?.user) return null
  return {
    user: {
      id: data.user.id,
      email: data.user.email,
      name: data.user.name,
      image: data.user.image ?? null,
    },
  }
}

/**
 * The auth calls below swallow their errors on purpose — a failed session
 * read must not block startup, and a failed sign-in has its own user-facing
 * message. Swallowed used to mean invisible: the errors went to
 * `console.warn`, i.e. to a device log nobody reads, carrying whatever the
 * auth client happened to put in the object.
 *
 * They now go to telemetry as an operation name plus an error *type* — never
 * the error's own message or payload, which for these particular calls can
 * contain the credentials that were being verified. The raw object is still
 * printed in development, where it is a local console and not a data store.
 */
function reportFailure(operation: string, error: unknown): void {
  if (__DEV__) console.warn(`[${operation}]`, error)
  telemetry.recordError(`${operation} failed`, { error, attributes: { 'app.operation': operation } })
}

export class HttpFridgeConnector implements FridgeConnector {
  async getSession(): Promise<Session | null> {
    try {
      const { data } = await authClient.getSession()
      return toSession(data)
    } catch (error) {
      // Return null if session check fails, this prevents blocking app startup
      reportFailure('identity.get_session', error)
      return null
    }
  }

  async getAuthMethods(): Promise<AuthMethod[]> {
    try {
      const result = await apiFetch<{ methods: AuthMethod[] }>('/api/auth/methods')
      return result.ok ? result.value.methods : []
    } catch (error) {
      reportFailure('identity.get_auth_methods', error)
      return []
    }
  }

  async signInEmail(email: string, password: string): Promise<Result<Session, ApiError>> {
    try {
      const { error } = await authClient.signIn.email({ email, password })
      if (error) {
        return Result.err({ type: error.code ?? 'sign_in_failed', message: error.message ?? 'Connexion impossible.' })
      }
      const session = await this.getSession()
      if (!session) return Result.err({ type: 'sign_in_failed', message: 'Connexion impossible.' })
      return Result.ok(session)
    } catch (error) {
      reportFailure('identity.sign_in_email', error)
      return Result.err({ type: 'sign_in_failed', message: 'Connexion impossible.' })
    }
  }

  async signUpEmail(email: string, password: string, name: string): Promise<Result<Session, ApiError>> {
    try {
      const { error } = await authClient.signUp.email({ email, password, name })
      if (error) {
        return Result.err({ type: error.code ?? 'sign_up_failed', message: error.message ?? 'Inscription impossible.' })
      }
      const session = await this.getSession()
      if (!session) return Result.err({ type: 'sign_up_failed', message: 'Inscription impossible.' })
      return Result.ok(session)
    } catch (error) {
      reportFailure('identity.sign_up_email', error)
      return Result.err({ type: 'sign_up_failed', message: 'Inscription impossible.' })
    }
  }

  async signInSocial(provider: 'pocketid'): Promise<Result<Session, ApiError>> {
    try {
      const { error } = await authClient.signIn.social({ provider, callbackURL: '/(tabs)' })
      if (error) {
        return Result.err({ type: error.code ?? 'sign_in_failed', message: error.message ?? 'Connexion impossible.' })
      }
      const session = await this.getSession()
      if (!session) return Result.err({ type: 'sign_in_failed', message: 'Connexion impossible.' })
      return Result.ok(session)
    } catch (error) {
      reportFailure('identity.sign_in_social', error)
      return Result.err({ type: 'sign_in_failed', message: 'Connexion impossible.' })
    }
  }

  async signOut(): Promise<void> {
    await authClient.signOut()
  }

  /**
   * `null` means the server said this account has no foyer. A failed read
   * **throws**, so TanStack marks the query `isError` rather than `data: null`.
   *
   * It used to answer `null` for both, and that conflation is now load-bearing
   * in the wrong direction: `(tabs)/_layout` reads this query to decide
   * whether to send someone to the onboarding, so a dropped connection in a
   * kitchen on one bar of signal would have told an existing member their
   * foyer was gone and offered them a form to create a second one. The Foyer
   * screen's own `isError` branch — three states, written precisely so a
   * failed read is not reported as "tu n'appartiens à aucun foyer" — could
   * never fire either, for the same reason.
   */
  async getHousehold(): Promise<Household | null> {
    const result = await apiFetch<{ household: Household | null }>('/api/households/mine');
    if (!result.ok) throw new Error(result.error.message)
    return result.value.household
  }

  async createHousehold(name: string): Promise<Result<Household, ApiError>> {
    const result = await apiFetch<{ household: Household }>('/api/households', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
    return result.ok ? Result.ok(result.value.household) : Result.err(result.error)
  }

  async joinHousehold(inviteCode: string): Promise<Result<Household, ApiError>> {
    const result = await apiFetch<{ household: Household }>('/api/households/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode }),
    })
    return result.ok ? Result.ok(result.value.household) : Result.err(result.error)
  }

  async regenerateInviteCode(): Promise<Result<string, ApiError>> {
    const result = await apiFetch<{ inviteCode: string }>('/api/households/invite-code/regenerate', {
      method: 'POST',
    })
    return result.ok ? Result.ok(result.value.inviteCode) : Result.err(result.error)
  }

  async removeHouseholdMember(userId: string): Promise<Result<void, ApiError>> {
    const result = await apiFetch<void>(`/api/households/members/${userId}`, { method: 'DELETE' })
    return result.ok ? Result.ok(undefined) : Result.err(result.error)
  }

  async leaveHousehold(): Promise<Result<void, ApiError>> {
    const result = await apiFetch<void>('/api/households/leave', { method: 'POST' })
    return result.ok ? Result.ok(undefined) : Result.err(result.error)
  }

  async getShoppingItems(): Promise<ShoppingItem[]> {
    const result = await apiFetch<{ items: ShoppingItem[] }>('/api/shopping-items')
    return result.ok ? result.value.items : []
  }

  async createShoppingItem(input: CreateShoppingItemInput): Promise<Result<ShoppingItem, ApiError>> {
    const result = await apiFetch<{ item: ShoppingItem }>('/api/shopping-items', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return result.ok ? Result.ok(result.value.item) : Result.err(result.error)
  }

  async updateShoppingItem(itemId: string, patch: UpdateShoppingItemInput): Promise<Result<ShoppingItem, ApiError>> {
    const result = await apiFetch<{ item: ShoppingItem }>(`/api/shopping-items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    return result.ok ? Result.ok(result.value.item) : Result.err(result.error)
  }

  async deleteShoppingItem(itemId: string): Promise<Result<void, ApiError>> {
    const result = await apiFetch<void>(`/api/shopping-items/${itemId}`, { method: 'DELETE' })
    return result.ok ? Result.ok(undefined) : Result.err(result.error)
  }

  async getRecipes(): Promise<Recipe[]> {
    const result = await apiFetch<{ recipes: Recipe[] }>('/api/recipes')
    return result.ok ? result.value.recipes : []
  }

  async getRecipe(recipeId: string): Promise<Recipe | null> {
    const result = await apiFetch<{ recipe: Recipe }>(`/api/recipes/${recipeId}`)
    return result.ok ? result.value.recipe : null
  }

  async generateRecipes(prompt?: string): Promise<Result<Recipe[], ApiError>> {
    const result = await apiFetch<{ recipes: Recipe[] }>('/api/recipes/generate', {
      method: 'POST',
      body: JSON.stringify(prompt ? { prompt } : {}),
    })
    return result.ok ? Result.ok(result.value.recipes) : Result.err(result.error)
  }

  async cookRecipe(recipeId: string, productIds: string[]): Promise<Result<Recipe, ApiError>> {
    const result = await apiFetch<{ recipe: Recipe }>(`/api/recipes/${recipeId}/cooked`, {
      method: 'POST',
      body: JSON.stringify({ productIds }),
    })
    return result.ok ? Result.ok(result.value.recipe) : Result.err(result.error)
  }

  async deleteRecipe(recipeId: string): Promise<Result<void, ApiError>> {
    const result = await apiFetch<void>(`/api/recipes/${recipeId}`, { method: 'DELETE' })
    return result.ok ? Result.ok(undefined) : Result.err(result.error)
  }

  async getProducts(params?: { location?: LocationValue; expiringWithinDays?: number }): Promise<Product[]> {
    const query = new URLSearchParams()
    if (params?.location) query.set('location', params.location)
    if (params?.expiringWithinDays) query.set('expiringWithinDays', String(params.expiringWithinDays))
    const qs = query.toString()
    const result = await apiFetch<{ products: Product[] }>(`/api/products${qs ? `?${qs}` : ''}`)
    return result.ok ? result.value.products : []
  }

  async getProduct(productId: string): Promise<Product | null> {
    const result = await apiFetch<{ product: Product }>(`/api/products/${productId}`)
    return result.ok ? result.value.product : null
  }

  async createProduct(input: CreateProductInput): Promise<Result<Product, ApiError>> {
    const result = await apiFetch<{ product: Product }>('/api/products', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return result.ok ? Result.ok(result.value.product) : Result.err(result.error)
  }

  async updateProduct(productId: string, patch: UpdateProductInput): Promise<Result<Product, ApiError>> {
    const result = await apiFetch<{ product: Product }>(`/api/products/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    return result.ok ? Result.ok(result.value.product) : Result.err(result.error)
  }

  async deleteProduct(productId: string): Promise<Result<void, ApiError>> {
    const result = await apiFetch<void>(`/api/products/${productId}`, { method: 'DELETE' })
    return result.ok ? Result.ok(undefined) : Result.err(result.error)
  }

  async getExpiringSoonProducts(days?: number): Promise<Product[]> {
    const qs = days ? `?days=${days}` : ''
    const result = await apiFetch<{ products: Product[] }>(`/api/products/expiring-soon${qs}`)
    return result.ok ? result.value.products : []
  }

  /**
   * `null` means the barcode is real but OpenFoodFacts has nothing for it —
   * a legitimate outcome the form turns into "remplis les champs à la main".
   * A failed request **throws**, same convention as `getHousehold`: it must
   * not collapse into that same `null`, or a dropped connection reads as
   * "this product doesn't exist" instead of "we couldn't check".
   */
  async lookupProductByBarcode(barcode: string): Promise<ProductLookupResult | null> {
    const result = await apiFetch<{ result: ProductLookupResult | null }>(
      `/api/products/lookup?barcode=${encodeURIComponent(barcode)}`,
    )
    if (!result.ok) throw new Error(result.error.message)
    return result.value.result
  }

  async scanReceipt(imageUri: string): Promise<Result<ReceiptDraft, ApiError>> {
    const formData = new FormData()
    // React Native's FormData accepts this { uri, name, type } shape for a file
    // part — it isn't a real Blob/File, but that's the platform's documented
    // multipart-upload convention, not a real DOM Blob.
    formData.append('image', { uri: imageUri, name: 'receipt.jpg', type: 'image/jpeg' } as unknown as Blob)
    const result = await apiFetchMultipart<{ draft: ReceiptDraft }>('/api/receipts/scan', formData)
    return result.ok ? Result.ok(result.value.draft) : Result.err(result.error)
  }

  async importReceipt(input: ImportReceiptInput): Promise<Result<{ receipt: Receipt; products: Product[] }, ApiError>> {
    const result = await apiFetch<{ receipt: Receipt; products: Product[] }>('/api/receipts/import', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return result.ok ? Result.ok(result.value) : Result.err(result.error)
  }

  async getReceipts(): Promise<Receipt[]> {
    const result = await apiFetch<{ receipts: Receipt[] }>('/api/receipts')
    return result.ok ? result.value.receipts : []
  }

  async getReceipt(receiptId: string): Promise<{ receipt: Receipt; products: Product[] } | null> {
    const result = await apiFetch<{ receipt: Receipt; products: Product[] }>(`/api/receipts/${receiptId}`)
    return result.ok ? result.value : null
  }

  async getAiSettings(): Promise<AiSettings | null> {
    const result = await apiFetch<AiSettings>('/api/settings/ai')
    return result.ok ? result.value : null
  }

  async setActiveAiProvider(provider: AiProvider): Promise<Result<AiSettings, ApiError>> {
    const result = await apiFetch<AiSettings>('/api/settings/ai', {
      method: 'PATCH',
      body: JSON.stringify({ provider }),
    })
    return result.ok ? Result.ok(result.value) : Result.err(result.error)
  }

  async getHaLink(): Promise<HaLink | null> {
    const result = await apiFetch<HaLink>('/api/settings/home-assistant')
    if (__DEV__) {
      // `JSON.stringify`, not the object itself: RN's console truncates a
      // nested array of objects (Vine's `details`) to `[Object]`, which is
      // exactly the part worth reading when the error is `validation_failed`.
      console.log('[home_assistant.get_link]', result.ok ? { configured: result.value.configured } : JSON.stringify({ error: result.error }))
    }
    return result.ok ? result.value : null
  }

  async saveHaConnection(input: SaveHaConnectionInput): Promise<Result<HaLink, ApiError>> {
    // Never the token, per the same rule the backend client follows.
    if (__DEV__) console.log('[home_assistant.save_connection] connecting', { instanceUrl: input.instanceUrl })
    const result = await apiFetch<HaLink>('/api/settings/home-assistant', {
      method: 'PUT',
      body: JSON.stringify(input),
    })
    if (__DEV__) {
      console.log('[home_assistant.save_connection]', result.ok ? 'connected' : JSON.stringify({ error: result.error }))
    }
    return result.ok ? Result.ok(result.value) : Result.err(result.error)
  }

  async discoverHaTodoEntities(input: DiscoverHaEntitiesInput): Promise<Result<HaTodoEntity[], ApiError>> {
    if (__DEV__) console.log('[home_assistant.discover] connecting', { instanceUrl: input.instanceUrl })
    const result = await apiFetch<{ entities: HaTodoEntity[] }>('/api/settings/home-assistant/discover', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    if (__DEV__) {
      console.log('[home_assistant.discover]', result.ok ? { entities: result.value.entities.length } : JSON.stringify({ error: result.error }))
    }
    return result.ok ? Result.ok(result.value.entities) : Result.err(result.error)
  }

  async bindHaList(input: BindHaListInput): Promise<Result<HaLink, ApiError>> {
    const result = await apiFetch<HaLink>('/api/settings/home-assistant', {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
    if (__DEV__) console.log('[home_assistant.bind_list]', result.ok ? { entity: input.todoEntityId } : JSON.stringify({ error: result.error }))
    return result.ok ? Result.ok(result.value) : Result.err(result.error)
  }

  async unlinkHa(): Promise<Result<void, ApiError>> {
    const result = await apiFetch<void>('/api/settings/home-assistant', { method: 'DELETE' })
    if (__DEV__) console.log('[home_assistant.unlink]', result.ok ? 'ok' : { error: result.error })
    return result.ok ? Result.ok(undefined) : Result.err(result.error)
  }

  async syncShoppingListWithHa(): Promise<Result<{ synced: boolean }, ApiError>> {
    const result = await apiFetch<{ synced: boolean }>('/api/shopping-items/sync', { method: 'POST' })
    return result.ok ? Result.ok(result.value) : Result.err(result.error)
  }
}
