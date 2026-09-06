import type { Result } from '../shared/result.js'
import type { ApiError } from '../shared/api-error.js'
import type { Session } from '../identity/session.js'
import type { Household } from '../identity/household.js'
import type { AuthMethod } from '../identity/auth-method.js'
import type { ShoppingItem, CreateShoppingItemInput, UpdateShoppingItemInput } from '../shopping-list/shopping-item.js'
import type { Recipe } from '../recipe/recipe.js'
import type { Product, CreateProductInput, UpdateProductInput } from '../fridge/product.js'
import type { LocationValue } from '../fridge/location.js'
import type { ProductLookupResult } from '../fridge/product-lookup-result.js'
import type { ReceiptDraft } from '../receipt/receipt-draft.js'
import type { Receipt, ImportReceiptInput } from '../receipt/receipt.js'
import type { AiSettings, AiProvider } from '../settings/ai-settings.js'

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
  getHousehold(): Promise<Household | null>
  /**
   * The two ways an account acquires a foyer. Both return the household the
   * caller now belongs to, so the screen that called them can seed the
   * `['household']` query instead of racing the gate that is about to read it.
   */
  createHousehold(name: string): Promise<Result<Household, ApiError>>
  joinHousehold(inviteCode: string): Promise<Result<Household, ApiError>>
  regenerateInviteCode(): Promise<Result<string, ApiError>>
  removeHouseholdMember(userId: string): Promise<Result<void, ApiError>>
  leaveHousehold(): Promise<Result<void, ApiError>>
  getShoppingItems(): Promise<ShoppingItem[]>
  createShoppingItem(input: CreateShoppingItemInput): Promise<Result<ShoppingItem, ApiError>>
  updateShoppingItem(itemId: string, patch: UpdateShoppingItemInput): Promise<Result<ShoppingItem, ApiError>>
  deleteShoppingItem(itemId: string): Promise<Result<void, ApiError>>
  getRecipes(): Promise<Recipe[]>
  getRecipe(recipeId: string): Promise<Recipe | null>
  /** `POST /api/recipes/generate` — the backend saves what it generates, so the list query is stale afterwards. */
  generateRecipes(prompt?: string): Promise<Result<Recipe[], ApiError>>
  deleteRecipe(recipeId: string): Promise<Result<void, ApiError>>
  /**
   * "J'ai cuisiné." `productIds` are the garde-manger products this meal used
   * up — sent from here because this is where the rapprochement between an
   * ingredient and a real product was confirmed; the backend never guesses it.
   */
  cookRecipe(recipeId: string, productIds: string[]): Promise<Result<Recipe, ApiError>>
  getProducts(params?: { location?: LocationValue; expiringWithinDays?: number }): Promise<Product[]>
  getProduct(productId: string): Promise<Product | null>
  createProduct(input: CreateProductInput): Promise<Result<Product, ApiError>>
  updateProduct(productId: string, patch: UpdateProductInput): Promise<Result<Product, ApiError>>
  deleteProduct(productId: string): Promise<Result<void, ApiError>>
  getExpiringSoonProducts(days?: number): Promise<Product[]>
  lookupProductByBarcode(barcode: string): Promise<ProductLookupResult | null>
  scanReceipt(imageUri: string): Promise<Result<ReceiptDraft, ApiError>>
  importReceipt(input: ImportReceiptInput): Promise<Result<{ receipt: Receipt; products: Product[] }, ApiError>>
  getReceipts(): Promise<Receipt[]>
  getReceipt(receiptId: string): Promise<{ receipt: Receipt; products: Product[] } | null>
  getAiSettings(): Promise<AiSettings | null>
  setActiveAiProvider(provider: AiProvider): Promise<Result<AiSettings, ApiError>>
}
