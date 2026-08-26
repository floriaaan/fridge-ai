import { Entity } from '#domain/shared/entity'

interface RecipeIngredientProps {
  recipeId: string
  productId: string | null
  label: string
  quantity: number | null
  unit: string | null
}

export class RecipeIngredient extends Entity<string> {
  private props: RecipeIngredientProps

  private constructor(id: string, props: RecipeIngredientProps) {
    super(id)
    this.props = props
  }

  static create(id: string, props: RecipeIngredientProps): RecipeIngredient {
    return new RecipeIngredient(id, props)
  }

  get recipeId(): string {
    return this.props.recipeId
  }

  get productId(): string | null {
    return this.props.productId
  }

  get label(): string {
    return this.props.label
  }

  get quantity(): number | null {
    return this.props.quantity
  }

  get unit(): string | null {
    return this.props.unit
  }
}
