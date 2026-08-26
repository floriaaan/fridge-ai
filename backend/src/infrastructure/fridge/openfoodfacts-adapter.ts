import type { ProductLookupPort, ProductLookupResult } from '#domain/fridge/interfaces/product-lookup-port.interface'

const OPENFOODFACTS_BASE_URL = 'https://world.openfoodfacts.org/api/v2/product'

interface OpenFoodFactsResponse {
  status: number
  product?: {
    product_name?: string
    categories_tags?: string[]
    image_url?: string
  }
}

/**
 * Server-side lookup only — barcode *decoding* stays on the app (ADR-0008).
 * "Not found" is `null`, never thrown — it's a normal, expected result the
 * app uses to fall back to a blank form.
 */
export class OpenFoodFactsAdapter implements ProductLookupPort {
  async lookupByBarcode(barcode: string): Promise<ProductLookupResult | null> {
    const response = await fetch(`${OPENFOODFACTS_BASE_URL}/${encodeURIComponent(barcode)}.json`)
    if (!response.ok) return null

    const body = (await response.json()) as OpenFoodFactsResponse
    if (body.status !== 1 || !body.product) return null

    const categories = body.product.categories_tags ?? null
    return {
      name: body.product.product_name ?? 'Produit inconnu',
      category: categories?.[0]?.replace(/^[a-z]{2}:/, '') ?? null,
      categories,
      imageUrl: body.product.image_url ?? null,
      openfoodfactId: barcode,
    }
  }
}
