import { Result } from '../../domain/shared/result.js'
import { fakeSession } from './fixtures/session.fixture.js'
import { fakeHousehold } from './fixtures/household.fixture.js'
import { normalizeInviteCode } from '../../domain/identity/invite-code.js'
import { fakeShoppingItems } from './fixtures/shopping-item.fixture.js'
import { fakeRecipes } from './fixtures/recipe.fixture.js'
import { fakeProducts } from './fixtures/product.fixture.js'
import { fakeProductLookup } from './fixtures/product-lookup.fixture.js'
import { fakeReceiptDraft } from './fixtures/receipt-draft.fixture.js'
import { fakeReceipts } from './fixtures/receipt.fixture.js'
import { fakeAiSettings } from './fixtures/ai-settings.fixture.js'
import { fakeUnconfiguredHaLink } from './fixtures/ha-link.fixture.js'
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
import type { HaLink, HaTodoEntity, SaveHaConnectionInput, BindHaListInput } from '../../domain/home-assistant/ha-link.js'

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
  /**
   * Nullable, because "signed in with no foyer yet" is a real state the app
   * now has a whole route group for. The fake used to hand every session the
   * same fixture household unconditionally, which made the onboarding
   * literally unreachable in dev: the gate that sends a foyer-less account to
   * `(onboarding)` could never fire against it.
   *
   * Which method leaves it null is the honest part: `signUpEmail` creates a
   * brand-new account and therefore has no foyer, `signInEmail`/`signInSocial`
   * return to one that already exists. So signing up is how you reach the
   * onboarding in dev — the same way you reach it in production, and how a
   * test reaches it too.
   *
   * It still *starts* on the fixture, because most screens are exercised
   * against a connector nobody signed into and they are all foyer screens: a
   * default of null would have made every one of them render its "no
   * household" branch instead of the thing under test.
   */
  private household: Household | null = { ...fakeHousehold, members: fakeHousehold.members.map((m) => ({ ...m })) }
  private nextInviteCode = 1
  private nextHouseholdId = 2
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
  private haLink: HaLink = { ...fakeUnconfiguredHaLink }
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

  private restoreFixtureHousehold(): Household {
    this.household = { ...fakeHousehold, members: fakeHousehold.members.map((m) => ({ ...m })) }
    return this.household
  }

  async signInEmail(email: string, password: string): Promise<Result<Session, ApiError>> {
    if (!email || !password) {
      return Result.err({ type: 'invalid_credentials', message: 'Email ou mot de passe invalide.' })
    }
    this.session = { user: { ...fakeSession.user, email } }
    this.restoreFixtureHousehold()
    return Result.ok(this.session)
  }

  async signUpEmail(email: string, _password: string, name: string): Promise<Result<Session, ApiError>> {
    this.session = { user: { ...fakeSession.user, email, name } }
    // A new account has no foyer. This is what makes `(onboarding)` reachable.
    this.household = null
    return Result.ok(this.session)
  }

  async signInSocial(): Promise<Result<Session, ApiError>> {
    this.session = fakeSession
    this.restoreFixtureHousehold()
    return Result.ok(this.session)
  }

  async signOut(): Promise<void> {
    this.session = null
  }

  async getHousehold(): Promise<Household | null> {
    if (!this.household) return null
    return { ...this.household, members: this.household.members.map((m) => ({ ...m })) }
  }

  async createHousehold(name: string): Promise<Result<Household, ApiError>> {
    if (this.household) {
      return Result.err({ type: 'already_in_household', message: 'Vous appartenez déjà à un foyer.' })
    }
    const trimmed = name.trim()
    if (trimmed.length === 0 || trimmed.length > 80) {
      return Result.err({ type: 'validation_failed', message: 'Le nom du foyer doit faire entre 1 et 80 caractères.' })
    }
    this.household = {
      id: `fake-household-${this.nextHouseholdId++}`,
      name: trimmed,
      // Eight characters of [A-Z0-9], like the real generator — see the fixture.
      inviteCode: this.nextFakeInviteCode(),
      role: 'owner',
      members: [
        {
          userId: this.session?.user.id ?? 'fake-user-1',
          name: this.session?.user.name ?? 'Toi',
          role: 'owner',
          joinedAt: new Date().toISOString(),
        },
      ],
    }
    return Result.ok((await this.getHousehold()) as Household)
  }

  async joinHousehold(inviteCode: string): Promise<Result<Household, ApiError>> {
    if (this.household) {
      return Result.err({ type: 'already_in_household', message: 'Vous appartenez déjà à un foyer.' })
    }
    // Only the fixture's own code opens the fixture foyer; every other
    // well-formed code takes the rejection branch, so both outcomes are
    // reachable in dev without a backend.
    if (normalizeInviteCode(inviteCode) !== fakeHousehold.inviteCode) {
      return Result.err({ type: 'invalid_invite_code', message: "Code d'invitation invalide." })
    }
    // Joining makes you a member, never the owner — and the backend omits
    // `inviteCode` entirely for a member, which is what the Foyer screen gates
    // its invite section on.
    const household = this.restoreFixtureHousehold()
    household.role = 'member'
    delete household.inviteCode
    household.members.push({
      userId: this.session?.user.id ?? 'fake-user-3',
      name: this.session?.user.name ?? 'Toi',
      role: 'member',
      joinedAt: new Date().toISOString(),
    })
    return Result.ok((await this.getHousehold()) as Household)
  }

  private nextFakeInviteCode(): string {
    return `FAKE${String(this.nextInviteCode++).padStart(4, '0')}`
  }

  async regenerateInviteCode(): Promise<Result<string, ApiError>> {
    if (this.household?.role !== 'owner') {
      return Result.err({ type: 'forbidden', message: 'Seul le propriétaire du foyer peut régénérer le code.' })
    }
    this.household.inviteCode = this.nextFakeInviteCode()
    return Result.ok(this.household.inviteCode)
  }

  async removeHouseholdMember(userId: string): Promise<Result<void, ApiError>> {
    if (this.household?.role !== 'owner') {
      return Result.err({ type: 'forbidden', message: 'Seul le propriétaire du foyer peut retirer un membre.' })
    }
    const index = this.household.members.findIndex((m) => m.userId === userId)
    if (index === -1) return Result.err({ type: 'not_found', message: 'Membre introuvable.' })
    this.household.members.splice(index, 1)
    return Result.ok(undefined)
  }

  async leaveHousehold(): Promise<Result<void, ApiError>> {
    // Null, not "the same household minus me". Either branch of the real
    // backend — an owner deleting the foyer, a member being removed from it —
    // leaves `GET /households/mine` answering null for this account, and the
    // gate that decides where a foyer-less user lands reads exactly that.
    this.household = null
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

  /**
   * "J'ai cuisiné": the count goes up and the products the meal used leave the
   * garde-manger — the fake has to model the consumption, because that is the
   * whole point of the action and the dashboard reads the same list.
   */
  async cookRecipe(recipeId: string, productIds: string[]): Promise<Result<Recipe, ApiError>> {
    for (const list of [this.generatedRecipes, this.recipes]) {
      const recipe = list.find((r) => r.id === recipeId)
      if (!recipe) continue
      this.products = this.products.filter((product) => !productIds.includes(product.id))
      const cooked: Recipe = {
        ...recipe,
        cookCount: recipe.cookCount + 1,
        lastCookedAt: new Date().toISOString(),
        lastCookedBy: this.session?.user.id ?? fakeSession.user.id,
      }
      list.splice(list.indexOf(recipe), 1, cooked)
      return Result.ok(cooked)
    }
    return Result.err({ type: 'not_found', message: 'Recette introuvable.' })
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
      createdBy: this.session?.user.id ?? fakeSession.user.id,
      cookCount: 0,
      lastCookedAt: null,
      lastCookedBy: null,
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

  async getHaLink(): Promise<HaLink | null> {
    return this.haLink
  }

  async saveHaConnection(input: SaveHaConnectionInput): Promise<Result<HaLink, ApiError>> {
    if (!input.token && !this.haLink.tokenSet) {
      return Result.err({ type: 'token_required', message: 'Un jeton est requis pour la première connexion.' })
    }
    this.haLink = { ...this.haLink, configured: true, instanceUrl: input.instanceUrl, tokenSet: true }
    return Result.ok(this.haLink)
  }

  async discoverHaTodoEntities(): Promise<Result<HaTodoEntity[], ApiError>> {
    return Result.ok([
      { entityId: 'todo.courses', friendlyName: 'Courses' },
      { entityId: 'todo.taches', friendlyName: 'Tâches' },
    ])
  }

  async bindHaList(input: BindHaListInput): Promise<Result<HaLink, ApiError>> {
    this.haLink = {
      ...this.haLink,
      todoEntityId: input.todoEntityId ?? this.haLink.todoEntityId,
      todoEntityName: input.todoEntityName ?? this.haLink.todoEntityName,
      direction: input.direction ?? this.haLink.direction,
      enabled: input.enabled ?? this.haLink.enabled,
    }
    return Result.ok(this.haLink)
  }

  async unlinkHa(): Promise<Result<void, ApiError>> {
    this.haLink = { ...fakeUnconfiguredHaLink }
    return Result.ok(undefined)
  }

  async syncShoppingListWithHa(): Promise<Result<{ synced: boolean }, ApiError>> {
    return Result.ok({ synced: this.haLink.configured && Boolean(this.haLink.todoEntityId) })
  }
}
