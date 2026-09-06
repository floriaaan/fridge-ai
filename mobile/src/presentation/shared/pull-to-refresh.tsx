/**
 * Pull-to-refresh, in one place, for every screen that reads shared
 * household state.
 *
 * The gap this closes is a product one, not a gesture one: a fridge is
 * shared, so the list on your phone goes stale the moment a flatmate scans a
 * receipt. The only ways to re-read it were killing the app or tapping
 * "Réessayer" inside an error card that only appears when the fetch already
 * failed — there was no way at all to refresh a screen that had loaded fine
 * and simply gone out of date. Pull-down is the gesture every user already
 * tries first on both platforms.
 *
 * `refreshing` is local state rather than `query.isFetching`: TanStack flips
 * `isFetching` for background refetches the user never asked for, which would
 * leave the spinner appearing on its own. It is set on the gesture and
 * cleared when the refetches settle, so the control is honest about what it
 * is reporting.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshControl } from 'react-native'
import type { SoftPalette } from '../dashboard/soft-palette.js'

export interface RefreshBinding {
  refreshing: boolean
  onRefresh: () => void
}

/**
 * Pass every query the screen shows. They refetch together — a screen that
 * refreshes half of what it displays is worse than one that refreshes none of
 * it, because the two halves then disagree.
 */
export function usePullToRefresh(...refetch: (() => Promise<unknown>)[]): RefreshBinding {
  const [refreshing, setRefreshing] = useState(false)
  // Kept in a ref so `onRefresh` stays referentially stable across the
  // re-render every query result causes; a new callback each render would
  // re-create the RefreshControl mid-gesture. Written in an effect rather
  // than during render — a ref write in the render body is a real hazard
  // under concurrent rendering, and this one has no reader before commit.
  const pending = useRef(refetch)
  useEffect(() => {
    pending.current = refetch
  })

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    Promise.all(pending.current.map((run) => run())).finally(() => setRefreshing(false))
  }, [])

  return { refreshing, onRefresh }
}

/**
 * The control itself. A function rather than a component because
 * `ScrollView`/`FlatList` clone the element they are handed and expect a real
 * `RefreshControl` — a wrapper component would not survive that.
 */
export function pullToRefreshControl(binding: RefreshBinding, palette: SoftPalette) {
  return (
    <RefreshControl
      refreshing={binding.refreshing}
      onRefresh={binding.onRefresh}
      // Lime on both platforms: this is a progress indicator, which is
      // exactly what DESIGN.md reserves the accent for. `progressBackgroundColor`
      // is the Android puck behind it — left on the ground colour so the puck
      // does not read as a second floating card.
      tintColor={palette.accentLime}
      colors={[palette.accentLime]}
      progressBackgroundColor={palette.gradientBottom}
    />
  )
}
