# ADR-0006 — Extraction receipt-scan via IA multimodale unique, pas d'OCR séparé

## Contexte

L'original avait un `ocr.service.ts` distinct des adapters IA (`gemini.ts`,
`openai.ts`, `ollama.ts`) — vraisemblablement OCR classique (Tesseract ou équivalent)
puis passage du texte brut à l'IA pour structuration. Les modèles vision actuels
(Gemini, GPT-4o/5, Ollama + llava/qwen2-vl) acceptent une image directement et
retournent une extraction structurée en un seul appel.

## Décision

`ReceiptExtractionPort.extract(image: Buffer): Promise<ReceiptDraft>` est le seul
port pour l'extraction — un appel IA multimodal, pas d'étape OCR intermédiaire ni de
dépendance OCR séparée.

## Conséquences

- Une dépendance en moins (pas de Tesseract/OCR lib à maintenir), un port de moins à
  tester.
- Couplé à la capacité vision du provider IA actif — si `AI_PROVIDER=ollama` est
  choisi avec un modèle texte-only (pas de variante vision installée localement),
  l'extraction échoue. À documenter clairement dans le `.env.example` (le modèle
  Ollama configuré doit supporter la vision).
- Pas de texte OCR brut à conserver pour audit/debug — si besoin de rejouer une
  extraction ratée, il faut re-uploader l'image (elle est conservée via `imageKey`
  après import, mais pas avant confirmation).
