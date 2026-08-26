import type { Product } from '../product.entity.js'
import type { LocationValue } from '../location.vo.js'

export interface ProductFilters {
  location?: LocationValue
  expiringWithinDays?: number
}

export interface ProductRepository {
  findById(id: string): Promise<Product | null>
  findByHousehold(householdId: string, filters?: ProductFilters): Promise<Product[]>
  findExpiringSoon(householdId: string, withinDays: number): Promise<Product[]>
  findByReceiptId(receiptId: string): Promise<Product[]>
  save(product: Product): Promise<void>
  delete(id: string): Promise<void>
}
