import type { UseCase } from '#application/shared/use-case'
import type {
  ProductLookupPort,
  ProductLookupResult,
} from '#domain/fridge/interfaces/product-lookup-port.interface'

export interface LookupProductInput {
  barcode: string
}

export class LookupProduct implements UseCase<LookupProductInput, ProductLookupResult | null> {
  constructor(private readonly lookup: ProductLookupPort) {}

  async execute(input: LookupProductInput): Promise<ProductLookupResult | null> {
    return this.lookup.lookupByBarcode(input.barcode)
  }
}
