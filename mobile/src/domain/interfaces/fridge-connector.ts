import type { Result } from '../shared/result.js'
import type { ApiError } from '../shared/api-error.js'
import type { Session } from '../identity/session.js'
import type { AuthMethod } from '../identity/auth-method.js'
import type { ShoppingItem } from '../shopping-list/shopping-item.js'
import type { Recipe } from '../recipe/recipe.js'

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
}
