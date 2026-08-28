import { Result } from '../../domain/shared/result.js'
import { fakeSession } from './fixtures/session.fixture.js'
import { fakeShoppingItems } from './fixtures/shopping-item.fixture.js'
import { fakeRecipes } from './fixtures/recipe.fixture.js'
import type { FridgeConnector } from '../../domain/interfaces/fridge-connector.js'
import type { Session } from '../../domain/identity/session.js'
import type { AuthMethod } from '../../domain/identity/auth-method.js'
import type { ApiError } from '../../domain/shared/api-error.js'
import type { ShoppingItem } from '../../domain/shopping-list/shopping-item.js'
import type { Recipe } from '../../domain/recipe/recipe.js'

/** In-memory only, resets on every reload — UI iteration without a running backend. */
export class FakeFridgeConnector implements FridgeConnector {
  private session: Session | null = null
  private shoppingItems: ShoppingItem[] = fakeShoppingItems.map((item) => ({ ...item }))

  async getSession(): Promise<Session | null> {
    return this.session
  }

  async getAuthMethods(): Promise<AuthMethod[]> {
    return [
      { id: 'password', enabled: true, label: 'Email et mot de passe' },
      { id: 'pocketid', enabled: true, label: 'PocketID' },
    ]
  }

  async signInEmail(email: string, password: string): Promise<Result<Session, ApiError>> {
    if (!email || !password) {
      return Result.err({ type: 'invalid_credentials', message: 'Email ou mot de passe invalide.' })
    }
    this.session = { user: { ...fakeSession.user, email } }
    return Result.ok(this.session)
  }

  async signUpEmail(email: string, _password: string, name: string): Promise<Result<Session, ApiError>> {
    this.session = { user: { ...fakeSession.user, email, name } }
    return Result.ok(this.session)
  }

  async signInSocial(): Promise<Result<Session, ApiError>> {
    this.session = fakeSession
    return Result.ok(this.session)
  }

  async signOut(): Promise<void> {
    this.session = null
  }

  async getShoppingItems(): Promise<ShoppingItem[]> {
    return this.shoppingItems
  }

  async toggleShoppingItem(itemId: string, checked: boolean): Promise<Result<ShoppingItem, ApiError>> {
    const item = this.shoppingItems.find((i) => i.id === itemId)
    if (!item) return Result.err({ type: 'not_found', message: 'Article introuvable.' })
    item.checked = checked
    item.updatedAt = new Date().toISOString()
    return Result.ok(item)
  }

  async getRecipes(): Promise<Recipe[]> {
    return fakeRecipes
  }
}
