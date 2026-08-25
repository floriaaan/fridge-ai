# Arborescence détaillée

Monorepo pnpm, deux packages (`backend/`, `mobile/`), outillage commun à la racine —
même structure racine qu'`arr` (Taskfile, compose, CI, docs/adr, docs/phase-0).

```
fridge-ai/
  package.json                       # workspaces: ["backend", "mobile"]
  pnpm-workspace.yaml
  Taskfile.yml
  .editorconfig
  .env.example
  .gitignore
  .github/workflows/{ci.yml,docker.yml}
  compose.yml
  compose.dev.yml
  eslint.config.mjs                  # config partagée, étendue par chaque package
  .dependency-cruiser.cjs            # règles communes de frontière (domain/application/infrastructure/presentation)
  docs/
    adr/
    phase-0/

  backend/
    package.json                     # name: fridge-ai-backend
    tsconfig.json
    adonisrc.ts
    .dependency-cruiser.cjs          # extends: '../.dependency-cruiser.cjs'
    Dockerfile
    ace.js
    docker-entrypoint.sh

    app/                             # colle Adonis pure, aucune logique métier
      exceptions/handler.ts          # délègue à presentation/shared/error-serializer
      middleware/
        auth_middleware.ts           # résout AuthenticatedUser via le port identity, colle Adonis only
        household_required_middleware.ts   # 403 si l'utilisateur n'a pas de foyer
        force_json_response_middleware.ts

    start/
      env.ts
      kernel.ts
      routes.ts                      # import unique : presentation/routes.ts
      validator.ts

    providers/                       # bindings DI par module, un fichier par bounded context
      api_provider.ts
      shared_provider.ts             # Clock, IdGenerator, EventBus
      identity_provider.ts           # AuthenticationPort, SessionPort, UserDirectory, HouseholdRepository
      fridge_provider.ts             # ProductRepository, ProductLookupPort (OpenFoodFacts)
      receipt_provider.ts            # ReceiptRepository, ReceiptExtractionPort (IA)
      shopping_list_provider.ts      # ShoppingItemRepository
      recipe_provider.ts             # RecipeRepository, RecipeGenerationPort (IA)
      settings_provider.ts           # AiProviderSettingsRepository, AiSettingsProvider
      storage_provider.ts            # StorageService (images)

    database/
      migrations/                    # cf. 03-schema-base-de-donnees.md pour le détail
      seeders/

    commands/                        # commandes Ace ponctuelles (ex: régénérer un invite code en masse)

    src/
      domain/
        identity/
          user.entity.ts
          email.vo.ts
          household.aggregate.ts
          household-member.entity.ts
          household-role.vo.ts       # 'owner' | 'member'
          invite-code.vo.ts
          auth-method.vo.ts          # description des méthodes d'auth exposables au front
          interfaces/
            authentication.interface.ts
            session.interface.ts
            user-directory.interface.ts
            household-repository.interface.ts
            auth-methods-provider.interface.ts
          user.events.ts             # UserCreated (déclenche création implicite de rien — le foyer reste un choix explicite)

        settings/                   # instance-wide, pas de householdId (cf. ADR-0007)
          ai-provider-settings.aggregate.ts
          ai-provider.vo.ts          # 'gemini' | 'openai' | 'ollama'
          interfaces/
            ai-provider-settings-repository.interface.ts
            ai-settings-provider.interface.ts

        fridge/
          product.entity.ts
          location.vo.ts             # 'fridge' | 'freezer' | 'pantry'
          quantity.vo.ts             # { amount: number; unit: string }
          interfaces/
            product-repository.interface.ts
            product-lookup.interface.ts   # port OpenFoodFacts

        receipt/
          receipt.entity.ts
          receipt-draft.vo.ts        # résultat d'extraction, non persisté
          receipt-draft-item.vo.ts
          interfaces/
            receipt-repository.interface.ts
            receipt-extraction.interface.ts   # port IA vision

        shopping-list/
          shopping-item.entity.ts
          shopping-item-source.vo.ts # 'manual' | 'auto_expired' | 'recipe'
          interfaces/
            shopping-item-repository.interface.ts

        recipe/
          recipe.aggregate.ts
          recipe-ingredient.entity.ts
          recipe-source.vo.ts        # 'ai' | 'user'
          interfaces/
            recipe-repository.interface.ts
            recipe-generation.interface.ts    # port IA texte

        shared/                      # même noyau tactique qu'arr, copié tel quel
          entity.ts
          aggregate-root.ts
          value-object.ts
          domain-event.ts
          result.ts
          validation-error.ts
          clock.interface.ts
          id-generator.interface.ts
          interfaces/
            storage-service.interface.ts      # port stockage images

      application/
        identity/
          get-current-user.use-case.ts
          sign-out.use-case.ts
          get-auth-methods.use-case.ts
          get-my-household.use-case.ts
          create-household.use-case.ts
          join-household.use-case.ts
          regenerate-invite-code.use-case.ts
          remove-household-member.use-case.ts
          leave-household.use-case.ts
        fridge/
          create-product.use-case.ts
          update-product.use-case.ts
          delete-product.use-case.ts
          get-product.use-case.ts
          list-products.use-case.ts
          list-expiring-soon-products.use-case.ts
          lookup-barcode.use-case.ts
        receipt/
          scan-receipt.use-case.ts    # appelle le port IA, retourne un ReceiptDraft — ne persiste rien
          import-receipt.use-case.ts  # persiste Receipt + crée les Product à partir du draft confirmé
          list-receipts.use-case.ts
          get-receipt.use-case.ts
        shopping-list/
          create-shopping-item.use-case.ts
          update-shopping-item.use-case.ts
          delete-shopping-item.use-case.ts
          list-shopping-items.use-case.ts
        recipe/
          generate-recipe.use-case.ts
          get-recipe-suggestions.use-case.ts
          list-recipes.use-case.ts
          get-recipe.use-case.ts
          delete-recipe.use-case.ts
        settings/
          get-effective-ai-settings.use-case.ts
          set-active-ai-provider.use-case.ts   # vérifie que le caller est owner d'un foyer
        shared/
          use-case.ts

      infrastructure/
        auth/
          better-auth/
            instance.ts               # copié du câblage arr, PocketID via genericOAuth
            authentication.adapter.ts
            session.adapter.ts
            account-registrar.adapter.ts
          auth-methods.provider.ts    # lit la config effective (password + oidc configuré ou non)
        database/
          identity/
            user_directory.lucid.ts
            user-directory.repository.ts
            household.lucid.ts
            household_member.lucid.ts
            household.mapper.ts
            household.repository.ts
          fridge/
            product.lucid.ts
            product.mapper.ts
            product.repository.ts
          receipt/
            receipt.lucid.ts
            receipt.mapper.ts
            receipt.repository.ts
          shopping-list/
            shopping_item.lucid.ts
            shopping-item.mapper.ts
            shopping-item.repository.ts
          recipe/
            recipe.lucid.ts
            recipe_ingredient.lucid.ts
            recipe.mapper.ts
            recipe.repository.ts
        openfoodfacts/
          openfoodfacts.adapter.ts    # implémente ProductLookupPort, seul point d'appel externe pour OFF
        ai/
          ai-provider-registry.ts     # résout+cache l'adapter actif via AiSettingsProvider, invalide sur changement de signature
          env-ai-settings-provider.ts # fusionne ai_provider_setting (DB) + credentials env → EffectiveAiSettings
          gemini.adapter.ts           # implémente ReceiptExtractionPort + RecipeGenerationPort
          openai.adapter.ts
          ollama.adapter.ts
          prompts.ts
        storage/
          local-disk-storage.adapter.ts   # implémente StorageService via AdonisJS Drive (driver local)
        shared/
          system-clock.ts
          uuid-id-generator.ts

      presentation/
        routes.ts                     # agrège tous les *.routes.ts
        identity/
          auth.routes.ts              # délègue /api/auth/* à better-auth (bridge fetch, copié d'arr)
          session.controller.ts
          household.controller.ts
          household.routes.ts
          household.dto.ts
          household.validator.ts
        fridge/
          product.controller.ts
          product.routes.ts
          product.dto.ts
          product.validator.ts
        receipt/
          receipt.controller.ts
          receipt.routes.ts
          receipt.dto.ts
          receipt.validator.ts
        shopping-list/
          shopping-item.controller.ts
          shopping-item.routes.ts
          shopping-item.dto.ts
          shopping-item.validator.ts
        recipe/
          recipe.controller.ts
          recipe.routes.ts
          recipe.dto.ts
          recipe.validator.ts
        settings/
          ai-settings.controller.ts
          ai-settings.routes.ts
          ai-settings.dto.ts
          ai-settings.validator.ts
        shared/
          auth-context.ts
          household-context.ts        # résout le household courant depuis l'utilisateur authentifié
          error-serializer.ts
          exception-handler.ts

    tests/
      unit/
      domain/
      application/
      infrastructure/
      functional/

  mobile/
    package.json                      # name: fridge-ai-mobile
    app.json                          # config Expo
    tsconfig.json
    babel.config.js
    metro.config.js
    eslint.config.js
    .dependency-cruiser.cjs

    app/                               # routing expo-router, fichiers fins uniquement
      _layout.tsx
      (auth)/
        _layout.tsx
        sign-in.tsx
        sign-up.tsx
      (onboarding)/
        create-household.tsx
        join-household.tsx
      (tabs)/
        _layout.tsx
        index.tsx                      # liste produits / frigo
        shopping-list.tsx
        recipes.tsx
        settings.tsx
      product/
        [id].tsx
        create.tsx
        scan-barcode.tsx
      receipt/
        scan.tsx
        confirm.tsx
      recipe/
        [id].tsx
        generate.tsx
      household/
        members.tsx
        invite.tsx

    src/
      domain/
        interfaces/
          fridge-connector.ts          # une seule grande interface, façon arr-connector
        identity/
          session.ts
          user.ts
          household.ts
          auth-method.ts
        fridge/
          product.ts
          location.ts
          quantity.ts
        receipt/
          receipt.ts
          receipt-draft.ts
        shopping-list/
          shopping-item.ts
        recipe/
          recipe.ts
        shared/
          result.ts
          api-error.ts

      application/
        shared/
          connector-context.tsx
          define-query.ts
          define-mutation.ts
          use-domain-query.ts
          use-domain-mutation.ts
        identity/
          session.query.ts
          auth-methods.query.ts
          household.query.ts
          sign-in.mutation.ts
          sign-out.mutation.ts
          create-household.mutation.ts
          join-household.mutation.ts
        fridge/
          products.query.ts
          expiring-soon.query.ts
          create-product.mutation.ts
          update-product.mutation.ts
          delete-product.mutation.ts
          lookup-barcode.mutation.ts
        receipt/
          scan-receipt.mutation.ts
          import-receipt.mutation.ts
          receipts.query.ts
        shopping-list/
          shopping-items.query.ts
          create-shopping-item.mutation.ts
          toggle-shopping-item.mutation.ts
          delete-shopping-item.mutation.ts
        recipe/
          recipes.query.ts
          generate-recipe.mutation.ts
          suggestions.query.ts

      infrastructure/
        http/
          http-fridge-connector.ts
          http-client.ts               # fetch wrapper, injecte le cookie de session
        fake/
          fake-fridge-connector.ts
          fixtures/

      presentation/
        identity/
          login-form.tsx
          auth-method-buttons.tsx      # rendu conditionnel selon auth-methods.query
          household-invite-card.tsx
        fridge/
          product-card.tsx
          product-list.tsx
          product-form.tsx
          barcode-scanner-view.tsx
          expiring-soon-banner.tsx
        receipt/
          receipt-camera-view.tsx
          receipt-draft-review.tsx
        shopping-list/
          shopping-item-row.tsx
        recipe/
          recipe-card.tsx
          recipe-detail.tsx
        ui/                            # primitives Tamagui, design via skill impeccable
          button.tsx
          card.tsx
          input.tsx
          sheet.tsx
          tabs.tsx
          ...
        shared/
          empty-state.tsx
          error-state.tsx
          theme-provider.tsx           # tokens Tamagui (light/dark)

      tamagui.config.ts

    providers/
      create-connector.ts              # choisit http-fridge-connector ou fake selon EXPO_PUBLIC_CONNECTOR
```

Notes de convention (héritées d'`arr`, cf. [ADR-0002](../adr/0002-structure-en-couches-arr.md)) :

- `app/models` (Adonis) reste vide côté backend — tous les modèles Lucid vivent sous
  `src/infrastructure/database/**/*.lucid.ts`, jamais accédés hors de leur
  repository. C'est intentionnel : ça force la frontière infrastructure/domaine même
  si Adonis ne l'impose pas nativement.
- `mobile/app/` (expo-router) est l'équivalent du `frontend/src/routes` d'arr : fichiers
  fins, aucune logique, ils importent des composants de `src/presentation`.
- Chaque module (`identity`, `fridge`, `receipt`, `shopping-list`, `recipe`) a son
  provider Adonis dédié côté backend — pas un unique `app_provider` fourre-tout.
