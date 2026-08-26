/**
 * Domain-owned (not infrastructure-owned) specifically so the application
 * layer can import these without violating the `application-only-depends-
 * on-domain` dependency-cruiser rule — mirrors `receipt-extraction.errors.ts`.
 * Task 5's three AI adapters throw them, Task 7's `GenerateRecipes`/
 * `SuggestRecipes` use-cases catch them.
 */
export class RecipeGenerationUnavailableError extends Error {
  constructor(public readonly provider: string) {
    super(`Recipe generation provider "${provider}" has no credentials configured.`)
  }
}

export class RecipeGenerationParseError extends Error {}
