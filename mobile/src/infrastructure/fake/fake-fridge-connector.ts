import { Result } from '../../domain/shared/result.js'
import { fakeSession } from './fixtures/session.fixture.js'
import { fakeHousehold } from './fixtures/household.fixture.js'
import { fakeShoppingItems } from './fixtures/shopping-item.fixture.js'
import { fakeRecipes } from './fixtures/recipe.fixture.js'
import { fakeProducts } from './fixtures/product.fixture.js'
import { fakeProductLookup } from './fixtures/product-lookup.fixture.js'
import { fakeReceiptDraft } from './fixtures/receipt-draft.fixture.js'
import { fakeReceipts } from './fixtures/receipt.fixture.js'
import { fakeAiSettings } from './fixtures/ai-settings.fixture.js'
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

/**
 * How long the fake pretends the AI is thinking, in milliseconds.
 *
 * The fake answered `generateRecipes` synchronously, so the composer's
 * blocking overlay appeared and vanished inside one frame and the flow read as
 * instantaneous — which is the one thing the real call is not. A loader you
 * cannot see is a loader you cannot judge, and every design decision about the
 * wait (what it says, how it moves, whether it blocks) was being made blind.
 *
 * Roughly what a provider takes for a short completion. It is a *fake's*
 * constant: nothing in production reads it.
 */
const DEFAULT_AI_LATENCY_MS = 2200

/** In-memory only, resets on every reload — UI iteration without a running backend. */
export class FakeFridgeConnector implements FridgeConnector {
  private session: Session | null = null
  private household: Household = { ...fakeHousehold, members: fakeHousehold.members.map((m) => ({ ...m })) }
  private nextInviteCode = 1
  private shoppingItems: ShoppingItem[] = fakeShoppingItems.map((item) => ({ ...item }))
  private products: Product[] = fakeProducts.map((p) => ({ ...p }))
  private nextProductId = 1
  private nextShoppingItemId = 1
  private receipts: Receipt[] = fakeReceipts.map((r) => ({ ...r }))
  private nextReceiptId = 1
  /**
   * A copy, not the module fixture: `deleteRecipe` mutates this list, and a
   * fake that spliced the shared array would delete the recipe for every other
   * connector instance in the same test run.
   */
  private recipes: Recipe[] = fakeRecipes.map((r) => ({ ...r }))
  private generatedRecipes: Recipe[] = []
  private nextRecipeId = 1
  private aiSettings: AiSettings = { ...fakeAiSettings, availableProviders: [...fakeAiSettings.availableProviders] }
  private readonly aiLatencyMs: number

  /** `aiLatencyMs: 0` for tests that want the generated data and not the wait. */
  constructor({ aiLatencyMs = DEFAULT_AI_LATENCY_MS }: { aiLatencyMs?: number } = {}) {
    this.aiLatencyMs = aiLatencyMs
  }

  private pretendToThink(): Promise<void> {
    if (this.aiLatencyMs <= 0) return Promise.resolve()
    return new Promise((resolve) => setTimeout(resolve, this.aiLatencyMs))
  }

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

  async getHousehold(): Promise<Household | null> {
    return { ...this.household, members: this.household.members.map((m) => ({ ...m })) }
  }

  async regenerateInviteCode(): Promise<Result<string, ApiError>> {
    if (this.household.role !== 'owner') {
      return Result.err({ type: 'forbidden', message: 'Seul le propriétaire du foyer peut régénérer le code.' })
    }
    this.household.inviteCode = `FRIDGE-NEW${this.nextInviteCode++}`
    return Result.ok(this.household.inviteCode)
  }

  async removeHouseholdMember(userId: string): Promise<Result<void, ApiError>> {
    if (this.household.role !== 'owner') {
      return Result.err({ type: 'forbidden', message: 'Seul le propriétaire du foyer peut retirer un membre.' })
    }
    const index = this.household.members.findIndex((m) => m.userId === userId)
    if (index === -1) return Result.err({ type: 'not_found', message: 'Membre introuvable.' })
    this.household.members.splice(index, 1)
    return Result.ok(undefined)
  }

  async leaveHousehold(): Promise<Result<void, ApiError>> {
    this.household.members = this.household.members.filter((m) => m.userId !== this.session?.user.id)
    return Result.ok(undefined)
  }

  async getShoppingItems(): Promise<ShoppingItem[]> {
    return [...this.shoppingItems]
  }

  async createShoppingItem(input: CreateShoppingItemInput): Promise<Result<ShoppingItem, ApiError>> {
    const now = new Date().toISOString()
    const item: ShoppingItem = {
      id: `fake-item-new-${this.nextShoppingItemId++}`,
      name: input.name,
      quantity: input.quantity,
      checked: false,
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    }
    this.shoppingItems.push(item)
    return Result.ok(item)
  }

  async updateShoppingItem(itemId: string, patch: UpdateShoppingItemInput): Promise<Result<ShoppingItem, ApiError>> {
    const item = this.shoppingItems.find((i) => i.id === itemId)
    if (!item) return Result.err({ type: 'not_found', message: 'Article introuvable.' })
    Object.assign(item, patch, { updatedAt: new Date().toISOString() })
    return Result.ok(item)
  }

  async deleteShoppingItem(itemId: string): Promise<Result<void, ApiError>> {
    const index = this.shoppingItems.findIndex((i) => i.id === itemId)
    if (index === -1) return Result.err({ type: 'not_found', message: 'Article introuvable.' })
    this.shoppingItems.splice(index, 1)
    return Result.ok(undefined)
  }

  async getRecipes(): Promise<Recipe[]> {
    return [...this.generatedRecipes, ...this.recipes]
  }

  async getRecipe(recipeId: string): Promise<Recipe | null> {
    return [...this.generatedRecipes, ...this.recipes].find((r) => r.id === recipeId) ?? null
  }

  async deleteRecipe(recipeId: string): Promise<Result<void, ApiError>> {
    for (const list of [this.generatedRecipes, this.recipes]) {
      const index = list.findIndex((r) => r.id === recipeId)
      if (index === -1) continue
      list.splice(index, 1)
      return Result.ok(undefined)
    }
    return Result.err({ type: 'not_found', message: 'Recette introuvable.' })
  }

  /**
   * Stands in for the backend's AI call by cooking whatever is closest to
   * expiring — enough to exercise the generate flow's pending/empty/success
   * states without a provider key.
   */
  async generateRecipes(prompt?: string): Promise<Result<Recipe[], ApiError>> {
    // Before the empty-fridge check, not after: the real call spends the same
    // seconds whatever it is about to answer, and a failure that returns
    // instantly while a success takes two seconds teaches the wrong shape.
    await this.pretendToThink()
    const usable = this.products.filter((p) => p.expiresAt !== null)
    if (usable.length === 0) {
      return Result.err({ type: 'no_products', message: 'Ajoute des produits au garde-manger pour générer une recette.' })
    }
    const soonest = [...usable].sort(
      (a, b) => new Date(a.expiresAt ?? 0).getTime() - new Date(b.expiresAt ?? 0).getTime(),
    )
    const used = soonest.slice(0, 3)
    const now = new Date().toISOString()
    const recipe: Recipe = {
      id: `fake-recipe-generated-${this.nextRecipeId++}`,
      title: `Idée express : ${used[0].name.toLowerCase()}`,
      description: prompt ? `Généré à partir de : ${prompt}` : 'Généré à partir de ce qu’il faut finir en premier.',
      source: 'ai_generated',
      instructions: used
        .map((product, index) => `${index + 1}. Préparer ${product.name.toLowerCase()} et réserver.`)
        .concat(`${used.length + 1}. Assembler, assaisonner, servir chaud.`)
        .join('\n'),
      preparationTime: 15 + used.length * 5,
      tags: ['anti-gaspi', 'rapide'],
      imageKey: null,
      ingredients: used.map((product, index) => ({
        id: `fake-generated-ingredient-${this.nextRecipeId}-${index}`,
        productId: product.id,
        label: product.name,
        quantity: product.quantity.amount,
        unit: product.quantity.unit,
      })),
      createdAt: now,
    }
    this.generatedRecipes.unshift(recipe)
    return Result.ok([recipe])
  }

  async getProducts(params?: { location?: LocationValue; expiringWithinDays?: number }): Promise<Product[]> {
    let result = this.products
    if (params?.location) result = result.filter((p) => p.location === params.location)
    if (params?.expiringWithinDays) {
      const threshold = Date.now() + params.expiringWithinDays * 24 * 60 * 60 * 1000
      result = result.filter((p) => p.expiresAt !== null && new Date(p.expiresAt).getTime() <= threshold)
    }
    return result
  }

  async getProduct(productId: string): Promise<Product | null> {
    return this.products.find((p) => p.id === productId) ?? null
  }

  async createProduct(input: CreateProductInput): Promise<Result<Product, ApiError>> {
    const now = new Date().toISOString()
    const product: Product = {
      id: `fake-product-new-${this.nextProductId++}`,
      name: input.name,
      quantity: input.quantity,
      location: input.location,
      category: input.category,
      expiresAt: input.expiresAt ?? null,
      openedAt: input.openedAt ?? null,
      openfoodfactId: input.openfoodfactId ?? null,
      categories: input.categories ?? null,
      receiptId: null,
      price: input.price ?? null,
      imageKey: null,
      createdAt: now,
      updatedAt: now,
    }
    this.products.push(product)
    return Result.ok(product)
  }

  async updateProduct(productId: string, patch: UpdateProductInput): Promise<Result<Product, ApiError>> {
    const product = this.products.find((p) => p.id === productId)
    if (!product) return Result.err({ type: 'product_not_found', message: 'Produit introuvable.' })
    Object.assign(product, patch, { updatedAt: new Date().toISOString() })
    return Result.ok(product)
  }

  async deleteProduct(productId: string): Promise<Result<void, ApiError>> {
    const index = this.products.findIndex((p) => p.id === productId)
    if (index === -1) return Result.err({ type: 'product_not_found', message: 'Produit introuvable.' })
    this.products.splice(index, 1)
    return Result.ok(undefined)
  }

  async getExpiringSoonProducts(days = 3): Promise<Product[]> {
    return this.getProducts({ expiringWithinDays: days })
  }

  async lookupProductByBarcode(barcode: string): Promise<ProductLookupResult | null> {
    return fakeProductLookup[barcode] ?? null
  }

  async scanReceipt(_imageUri: string): Promise<Result<ReceiptDraft, ApiError>> {
    return Result.ok({ ...fakeReceiptDraft, items: fakeReceiptDraft.items.map((item) => ({ ...item })) })
  }

  async importReceipt(input: ImportReceiptInput): Promise<Result<{ receipt: Receipt; products: Product[] }, ApiError>> {
    const now = new Date().toISOString()
    const receipt: Receipt = {
      id: `fake-receipt-new-${this.nextReceiptId++}`,
      storeName: input.storeName,
      scannedAt: input.scannedAt,
      totalAmount: input.totalAmount,
      imageKey: null,
      itemsCount: input.items.length,
      createdAt: now,
    }
    this.receipts.push(receipt)

    const products: Product[] = input.items.map((item) => {
      const product: Product = {
        id: `fake-product-from-receipt-${this.nextProductId++}`,
        name: item.name,
        quantity: { amount: item.quantity, unit: item.unit },
        location: item.location,
        category: item.category ?? 'Non classé',
        expiresAt: item.expiresAt ?? null,
        openedAt: null,
        categories: null,
        openfoodfactId: null,
        receiptId: receipt.id,
        price: item.price ?? null,
        imageKey: null,
        createdAt: now,
        updatedAt: now,
      }
      this.products.push(product)
      return product
    })

    return Result.ok({ receipt, products })
  }

  async getReceipts(): Promise<Receipt[]> {
    return this.receipts
  }

  async getReceipt(receiptId: string): Promise<{ receipt: Receipt; products: Product[] } | null> {
    const receipt = this.receipts.find((r) => r.id === receiptId)
    if (!receipt) return null
    return { receipt, products: this.products.filter((p) => p.receiptId === receiptId) }
  }

  async getAiSettings(): Promise<AiSettings | null> {
    return this.aiSettings
  }

  async setActiveAiProvider(provider: AiProvider): Promise<Result<AiSettings, ApiError>> {
    if (!this.aiSettings.availableProviders.includes(provider)) {
      return Result.err({ type: 'provider_not_available', message: "Ce fournisseur n'est pas configuré." })
    }
    this.aiSettings = { ...this.aiSettings, activeProvider: provider }
    return Result.ok(this.aiSettings)
  }
}
