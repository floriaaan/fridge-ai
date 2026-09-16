import db from '@adonisjs/lucid/services/db'
import type {
  PublicStats,
  PublicStatsPort,
} from '#domain/instance/interfaces/public-stats.interface'

/** One round-trip, three scalar subqueries. */
export class LucidPublicStatsAdapter implements PublicStatsPort {
  async getStats(): Promise<PublicStats> {
    const { rows } = await db.rawQuery(
      `select
          (select count(*) from household)::int as households,
          (select count(*) from product_outcome where kind = 'consumed')::int as products_consumed,
          (select count(*) from recipe where source = 'ai')::int as recipes_generated`,
    )
    const row = (
      rows as { households: number; products_consumed: number; recipes_generated: number }[]
    )[0]!
    return {
      households: row.households,
      productsConsumed: row.products_consumed,
      recipesGenerated: row.recipes_generated,
    }
  }
}
