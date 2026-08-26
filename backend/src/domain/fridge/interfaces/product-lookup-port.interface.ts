export interface ProductLookupResult {
  name: string
  category: string | null
  categories: string[] | null
  imageUrl: string | null
  openfoodfactId: string
}

export interface ProductLookupPort {
  lookupByBarcode(barcode: string): Promise<ProductLookupResult | null>
}
