/** Structurally identical to the backend's `ProductLookupResult` (`product-lookup-port.interface.ts`). */
export interface ProductLookupResult {
  name: string
  category: string | null
  categories: string[] | null
  imageUrl: string | null
  openfoodfactId: string
}
