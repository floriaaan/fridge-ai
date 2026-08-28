import type { ProductLookupResult } from '../../../domain/fridge/product-lookup-result.js'

/** Keyed by barcode — `FakeFridgeConnector.lookupProductByBarcode()` looks up this map, `null` for anything else. */
export const fakeProductLookup: Record<string, ProductLookupResult> = {
  '3017620422003': {
    name: 'Pâte à tartiner noisettes-cacao',
    category: 'Pâtes à tartiner',
    categories: ['petit-déjeuner', 'sucré'],
    imageUrl: null,
    openfoodfactId: '3017620422003',
  },
}
