/**
 * Instance-wide counts shown on the public landing page. Aggregates only —
 * nothing here may ever identify a household, a member or a product.
 */
export interface PublicStats {
  households: number
  /** `product_outcome` rows of kind `consumed`: products eaten rather than thrown away. */
  productsConsumed: number
  /** Recipes whose `source` is `ai`. */
  recipesGenerated: number
}

export interface PublicStatsPort {
  getStats(): Promise<PublicStats>
}
