import { router } from 'expo-router'

/**
 * `router.back()` throws ("The action 'GO_BACK' was not handled by any
 * navigator") when there's no history entry to pop — reachable on web
 * whenever this route is the first page the tab loaded (a hard refresh, a
 * typed/bookmarked URL, or a modal-presented route that never picked up a
 * real back-stack entry on web). Every close/back affordance that can be
 * reached without necessarily having pushed through the app first (a
 * scanner's own close button, chiefly) needs this instead of a bare
 * `router.back()`.
 */
export function goBack(fallback: Parameters<typeof router.replace>[0]) {
  if (router.canGoBack()) {
    router.back()
    return
  }
  router.replace(fallback)
}
