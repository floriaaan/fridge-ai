import { Result } from '../../domain/shared/result.js'
import { fakeSession } from './fixtures/session.fixture.js'
import { fakeShoppingItems } from './fixtures/shopping-item.fixture.js'
import { fakeRecipes } from './fixtures/recipe.fixture.js'
import { fakeProducts } from './fixtures/product.fixture.js'
import { fakeProductLookup } from './fixtures/product-lookup.fixture.js'
import { fakeReceiptDraft } from './fixtures/receipt-draft.fixture.js'
import { fakeReceipts } from './fixtures/receipt.fixture.js'
import { fakeAiSettings } from './fixtures/ai-settings.fixture.js'
import type { FridgeConnector } from '../../domain/interfaces/fridge-connector.js'
import type { Session } from '../../domain/identity/session.js'
import type { AuthMethod } from '../../domain/identity/auth-method.js'
import type { ApiError } from '../../domain/shared/api-error.js'
import type { ShoppingItem } from '../../domain/shopping-list/shopping-item.js'
import type { Recipe } from '../../domain/recipe/recipe.js'
import type { Product, CreateProductInput, UpdateProductInput } from '../../domain/fridge/product.js'
import type { LocationValue } from '../../domain/fridge/location.js'
import type { ProductLookupResult } from '../../domain/fridge/product-lookup-result.js'
import type { ReceiptDraft } from '../../domain/receipt/receipt-draft.js'
import type { Receipt, ImportReceiptInput } from '../../domain/receipt/receipt.js'
import type { AiSettings, AiProvider } from '../../domain/settings/ai-settings.js'

/** In-memory only, resets on every reload — UI iteration without a running backend. */
export class FakeFridgeConnector implements FridgeConnector {
  private session: Session | null = null
  private shoppingItems: ShoppingItem[] = fakeShoppingItems.map((item) => ({ ...item }))
  private products: Product[] = fakeProducts.map((p) => ({ ...p }))
  private nextProductId = 1
  private receipts: Receipt[] = fakeReceipts.map((r) => ({ ...r }))
  private nextReceiptId = 1
  private aiSettings: AiSettings = { ...fakeAiSettings, availableProviders: [...fakeAiSettings.availableProviders] }

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
