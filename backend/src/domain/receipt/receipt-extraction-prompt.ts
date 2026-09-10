/**
 * Shared by all three `ReceiptExtractionPort` adapters (Task 9) — one place
 * owns the prompt's contract, the same role `recipe-generation-prompt.ts`
 * plays on the `RecipeGenerationPort` side. It used to be copy-pasted
 * identically into each adapter, three places to drift out of sync.
 *
 * Three rules were added after real receipts kept polluting le garde-manger:
 * a raw thermal-printer line becomes a fridge product name verbatim
 * otherwise, promo/discount noise and all.
 */
export const RECEIPT_EXTRACTION_PROMPT = `Analyse cette photo de ticket de caisse et retourne UNIQUEMENT un JSON de la forme :
{"storeName": string, "scannedAt": string (ISO 8601), "totalAmount": number, "items": [{"name": string, "quantity": number, "unit": string, "category": string | null, "price": number | null}]}

Règles pour "items" :
- N'inclus que les produits alimentaires ou destinés au garde-manger, au frigo ou au congélateur. Exclus tout le reste : sacs, consigne, frais de service, carte de fidélité, remises, sous-totaux, totaux, taxes, et toute ligne qui n'est pas un produit réel.
- "name" doit être un nom de produit propre et lisible. Retire toute mention promotionnelle ou de remise ("PROMO", "-20%", "2E GRATUIT", "OFFRE", codes/références internes du magasin) — le nom ne doit décrire que le produit.
- Si le libellé du ticket est une abréviation de caissier peu claire (ex. "PDT BIO", "LT 1/2 ECR", "YAB NAT"), déduis et écris le nom complet et compréhensible le plus probable plutôt que de copier l'abréviation telle quelle.

Pas de texte hors du JSON.`
