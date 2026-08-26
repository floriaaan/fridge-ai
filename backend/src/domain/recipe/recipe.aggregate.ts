import { AggregateRoot } from '#domain/shared/aggregate-root'
import { RecipeIngredient } from './recipe-ingredient.entity.js'
import type { RecipeSource } from './recipe-source.vo.js'

interface RecipeProps {
  householdId: string
  title: string
  description: string | null
  source: RecipeSource
  instructions: string
  preparationTime: number | null
  tags: string[]
  imageKey: string | null
  ingredients: RecipeIngredient[]
  createdAt: Date
}

export interface CreateRecipeIngredientProps {
  id: string
  productId?: string | null
  label: string
  quantity?: number | null
  unit?: string | null
}

export interface CreateRecipeProps {
  id: string
  householdId: string
  title: string
  source: RecipeSource
  instructions: string
  ingredients: CreateRecipeIngredientProps[]
  description?: string | null
  preparationTime?: number | null
  tags?: string[]
  imageKey?: string | null
  createdAt: Date
}

export class Recipe extends AggregateRoot<string> {
  private props: RecipeProps

  private constructor(id: string, props: RecipeProps) {
    super(id)
    this.props = props
  }

  static create(params: CreateRecipeProps): Recipe {
    const ingredients = params.ingredients.map((i) =>
      RecipeIngredient.create(i.id, {
        recipeId: params.id,
        productId: i.productId ?? null,
        label: i.label,
        quantity: i.quantity ?? null,
        unit: i.unit ?? null,
      }),
    )

    return new Recipe(params.id, {
      householdId: params.householdId,
      title: params.title,
      description: params.description ?? null,
      source: params.source,
      instructions: params.instructions,
      preparationTime: params.preparationTime ?? null,
      tags: params.tags ?? [],
      imageKey: params.imageKey ?? null,
      ingredients,
      createdAt: params.createdAt,
    })
  }

  /** Rehydrates an aggregate from persisted state — used by the mapper (Task 6). */
  static reconstruct(id: string, props: RecipeProps): Recipe {
    return new Recipe(id, props)
  }

  get householdId(): string {
    return this.props.householdId
  }

  get title(): string {
    return this.props.title
  }

  get description(): string | null {
    return this.props.description
  }

  get source(): RecipeSource {
    return this.props.source
  }

  get instructions(): string {
    return this.props.instructions
  }

  get preparationTime(): number | null {
    return this.props.preparationTime
  }

  get tags(): string[] {
    return this.props.tags
  }

  get imageKey(): string | null {
    return this.props.imageKey
  }

  get ingredients(): RecipeIngredient[] {
    return this.props.ingredients
  }

  get createdAt(): Date {
    return this.props.createdAt
  }
}
