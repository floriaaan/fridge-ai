/**
 * The pre-auth funnel's photos. `KITCHEN_PHOTO_URI` (singular) is the one
 * sign-in/sign-up's `AuthPhotoBackground` uses — a single, static ground.
 * `KITCHEN_PHOTO_URIS` is the fuller set the welcome screen cross-fades
 * through; its first entry is the same photo, so a device that never
 * advances past slide one (Reduce Motion, or just bad luck on timing) still
 * shows the exact image the auth screens carry forward, keeping the "one
 * continuous moment" claim true even in that case.
 *
 * All three: Unsplash License (free for commercial use, no attribution
 * required). Sized/cropped via Unsplash's own imgix params rather than
 * shipping bundled assets — one remote request each, no binaries in the
 * repo to keep in sync if art direction changes again.
 */
export const KITCHEN_PHOTO_URIS: readonly string[] = [
  // Kelly Moon — a kitchen window, sun through the blinds. unsplash.com/photos/FH1t3LsPg5c
  'https://images.unsplash.com/photo-1635830673200-b0c81b583233?fm=jpg&q=80&w=1600&fit=crop&crop=entropy&auto=format',
  // Marisol Benitez — a warm pile of fresh vegetables. unsplash.com/photos/QvkAQTNj4zk
  'https://images.unsplash.com/photo-1579113800032-c38bd7635818?fm=jpg&q=80&w=1600&fit=crop&crop=entropy&auto=format',
  // Linus Belanger — morning light over a kitchen sink. unsplash.com/photos/siZbxDGY2mA
  'https://images.unsplash.com/photo-1716589877120-8c022f580f01?fm=jpg&q=80&w=1600&fit=crop&crop=entropy&auto=format',
]

export const KITCHEN_PHOTO_URI = KITCHEN_PHOTO_URIS[0]
