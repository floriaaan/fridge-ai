import type { Result } from '../shared/result.js'
import type { ApiError } from '../shared/api-error.js'
import type { Session } from '../identity/session.js'
import type { AuthMethod } from '../identity/auth-method.js'
import type { ShoppingItem } from '../shopping-list/shopping-item.js'
import type { Recipe } from '../recipe/recipe.js'
import type { Product, CreateProductInput, UpdateProductInput } from '../fridge/product.js'
import type { LocationValue } from '../fridge/location.js'
import type { ProductLookupResult } from '../fridge/product-lookup-result.js'

/**
 * The app's one abstraction boundary over the backend. Extended by one
 * method group per bounded context, one phase at a time — never a
 * placeholder method for a context this phase doesn't build.
 */
export interface FridgeConnector {
  getSession(): Promise<Session | null>
  getAuthMethods(): Promise<AuthMethod[]>
  signInEmail(email: string, password: string): Promise<Result<Session, ApiError>>
  signUpEmail(email: string, password: string, name: string): Promise<Result<Session, ApiError>>
  signInSocial(provider: 'pocketid'): Promise<Result<Session, ApiError>>
  signOut(): Promise<void>
  getShoppingItems(): Promise<ShoppingItem[]>
  toggleShoppingItem(itemId: string, checked: boolean): Promise<Result<ShoppingItem, ApiError>>
  getRecipes(): Promise<Recipe[]>
  getProducts(params?: { location?: LocationValue; expiringWithinDays?: number }): Promise<Product[]>
  getProduct(productId: string): Promise<Product | null>
  createProduct(input: CreateProductInput): Promise<Result<Product, ApiError>>
  updateProduct(productId: string, patch: UpdateProductInput): Promise<Result<Product, ApiError>>
  deleteProduct(productId: string): Promise<Result<void, ApiError>>
  getExpiringSoonProducts(days?: number): Promise<Product[]>
  lookupProductByBarcode(barcode: string): Promise<ProductLookupResult | null>
}
