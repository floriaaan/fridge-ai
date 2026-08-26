import { Product } from '#domain/fridge/product.entity'
import { Quantity } from '#domain/fridge/quantity.vo'
import { Location } from '#domain/fridge/location.vo'
import type ProductModel from './product.lucid.js'

export function toDomain(row: ProductModel): Product {
  const quantity = Quantity.create(row.quantity, row.unit)
  if (!quantity.ok) throw new Error(`Corrupted product row ${row.id}: ${quantity.error.message}`)

  const location = Location.create(row.location)
  if (!location.ok) throw new Error(`Corrupted product row ${row.id}: ${location.error.message}`)

  return Product.reconstruct(row.id, {
    householdId: row.householdId,
    receiptId: row.receiptId,
    name: row.name,
    quantity: quantity.value,
    location: location.value,
    expiresAt: row.expiresAt?.toJSDate() ?? null,
    openedAt: row.openedAt?.toJSDate() ?? null,
    category: row.category,
    openfoodfactId: row.openfoodfactId,
    categories: row.categories,
    price: row.price === null ? null : Number(row.price),
    imageKey: row.imageKey,
    createdAt: row.createdAt.toJSDate(),
    updatedAt: row.updatedAt.toJSDate(),
  })
}
