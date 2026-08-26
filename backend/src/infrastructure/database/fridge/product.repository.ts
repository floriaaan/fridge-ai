import { DateTime } from 'luxon'
import ProductModel from './product.lucid.js'
import { toDomain } from './product.mapper.js'
import type { ProductRepository, ProductFilters } from '#domain/fridge/interfaces/product-repository.interface'
import type { Product } from '#domain/fridge/product.entity'

export class LucidProductRepository implements ProductRepository {
  async findById(id: string): Promise<Product | null> {
    const row = await ProductModel.find(id)
    return row ? toDomain(row) : null
  }

  async findByHousehold(householdId: string, filters: ProductFilters = {}): Promise<Product[]> {
    const query = ProductModel.query().where('household_id', householdId)
    if (filters.location) query.where('location', filters.location)
    if (filters.expiringWithinDays !== undefined) {
      const now = new Date()
      const threshold = new Date(now.getTime() + filters.expiringWithinDays * 24 * 60 * 60 * 1000)
      query
        .whereNotNull('expires_at')
        .where('expires_at', '>=', now.toISOString())
        .where('expires_at', '<=', threshold.toISOString())
    }
    const rows = await query.orderBy('expires_at', 'asc')
    return rows.map(toDomain)
  }

  async findExpiringSoon(householdId: string, withinDays: number): Promise<Product[]> {
    return this.findByHousehold(householdId, { expiringWithinDays: withinDays })
  }

  async findByReceiptId(receiptId: string): Promise<Product[]> {
    const rows = await ProductModel.query().where('receipt_id', receiptId)
    return rows.map(toDomain)
  }

  async save(product: Product): Promise<void> {
    await ProductModel.updateOrCreate(
      { id: product.id },
      {
        householdId: product.householdId,
        receiptId: product.receiptId,
        name: product.name,
        quantity: product.quantity.amount,
        unit: product.quantity.unit,
        location: product.location.value,
        expiresAt: product.expiresAt ? DateTime.fromJSDate(product.expiresAt) : null,
        openedAt: product.openedAt ? DateTime.fromJSDate(product.openedAt) : null,
        category: product.category,
        openfoodfactId: product.openfoodfactId,
        categories: product.categories,
        price: product.price,
        imageKey: product.imageKey,
      },
    )
  }

  async delete(id: string): Promise<void> {
    await ProductModel.query().where('id', id).delete()
  }
}
