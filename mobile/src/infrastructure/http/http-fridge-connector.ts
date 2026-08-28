import { authClient } from '../auth/auth-client.js'
import { apiFetch } from './http-client.js'
import { Result } from '../../domain/shared/result.js'
import type { FridgeConnector } from '../../domain/interfaces/fridge-connector.js'
import type { Session } from '../../domain/identity/session.js'
import type { AuthMethod } from '../../domain/identity/auth-method.js'
import type { ApiError } from '../../domain/shared/api-error.js'
import type { ShoppingItem } from '../../domain/shopping-list/shopping-item.js'
import type { Recipe } from '../../domain/recipe/recipe.js'
import type { Product, CreateProductInput, UpdateProductInput } from '../../domain/fridge/product.js'
import type { LocationValue } from '../../domain/fridge/location.js'
import type { ProductLookupResult } from '../../domain/fridge/product-lookup-result.js'

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

export class HttpFridgeConnector implements FridgeConnector {
  async getSession(): Promise<Session | null> {
    const { data } = await authClient.getSession()
    return toSession(data)
  }

  async getAuthMethods(): Promise<AuthMethod[]> {
    const result = await apiFetch<{ methods: AuthMethod[] }>('/api/auth/methods')
    return result.ok ? result.value.methods : []
  }

  async signInEmail(email: string, password: string): Promise<Result<Session, ApiError>> {
    const { error } = await authClient.signIn.email({ email, password })
    if (error) {
      return Result.err({ type: error.code ?? 'sign_in_failed', message: error.message ?? 'Connexion impossible.' })
    }
    const session = await this.getSession()
    if (!session) return Result.err({ type: 'sign_in_failed', message: 'Connexion impossible.' })
    return Result.ok(session)
  }

  async signUpEmail(email: string, password: string, name: string): Promise<Result<Session, ApiError>> {
    const { error } = await authClient.signUp.email({ email, password, name })
    if (error) {
      return Result.err({ type: error.code ?? 'sign_up_failed', message: error.message ?? 'Inscription impossible.' })
    }
    const session = await this.getSession()
    if (!session) return Result.err({ type: 'sign_up_failed', message: 'Inscription impossible.' })
    return Result.ok(session)
  }

  async signInSocial(provider: 'pocketid'): Promise<Result<Session, ApiError>> {
    const { error } = await authClient.signIn.social({ provider, callbackURL: '/(tabs)' })
    if (error) {
      return Result.err({ type: error.code ?? 'sign_in_failed', message: error.message ?? 'Connexion impossible.' })
    }
    const session = await this.getSession()
    if (!session) return Result.err({ type: 'sign_in_failed', message: 'Connexion impossible.' })
    return Result.ok(session)
  }

  async signOut(): Promise<void> {
    await authClient.signOut()
  }

  async getShoppingItems(): Promise<ShoppingItem[]> {
    const result = await apiFetch<{ items: ShoppingItem[] }>('/api/shopping-items')
    return result.ok ? result.value.items : []
  }

  async toggleShoppingItem(itemId: string, checked: boolean): Promise<Result<ShoppingItem, ApiError>> {
    const result = await apiFetch<{ item: ShoppingItem }>(`/api/shopping-items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ checked }),
    })
    return result.ok ? Result.ok(result.value.item) : Result.err(result.error)
  }

  async getRecipes(): Promise<Recipe[]> {
    const result = await apiFetch<{ recipes: Recipe[] }>('/api/recipes')
    return result.ok ? result.value.recipes : []
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

  async lookupProductByBarcode(barcode: string): Promise<ProductLookupResult | null> {
    const result = await apiFetch<{ result: ProductLookupResult | null }>(
      `/api/products/lookup?barcode=${encodeURIComponent(barcode)}`,
    )
    return result.ok ? result.value.result : null
  }
}
