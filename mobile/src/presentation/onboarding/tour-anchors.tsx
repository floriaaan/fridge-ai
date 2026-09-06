/*
 * Where the tour points.
 *
 * The four sections introduce themselves on the dashboard that is already
 * running, not on four pictures of it, so the tour needs the window rectangle
 * of four real elements. `TourAnchor` wraps an element and reports its
 * measured box; everything else in the app renders it as a plain passthrough,
 * because outside a provider `register` is a no-op.
 *
 * The set is deliberately made of things that exist at *every* width. The
 * obvious anchors would have been the four tab-bar destinations — but the web
 * build's bottom chrome is a glass pill naming only the current section, so
 * three of those four labels are not on screen to point at. The hero, the
 * metrics, the two tiles and the FAB are.
 */
import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react'
import { View } from 'react-native'

export type TourAnchorId = 'hero' | 'stats' | 'navcards' | 'fab'

export interface AnchorBox {
  x: number
  y: number
  width: number
  height: number
}

interface TourAnchorRegistry {
  /** Measures on demand rather than caching: the dashboard scrolls, and a cached box would point at where the card used to be. */
  measure: (id: TourAnchorId) => Promise<AnchorBox | null>
  register: (id: TourAnchorId, view: View | null) => void
}

const noop: TourAnchorRegistry = {
  measure: async () => null,
  register: () => {},
}

const TourAnchorContext = createContext<TourAnchorRegistry>(noop)

export function TourAnchorProvider({ children }: { children: ReactNode }) {
  const views = useRef(new Map<TourAnchorId, View>())

  const register = useCallback((id: TourAnchorId, view: View | null) => {
    if (view) views.current.set(id, view)
    else views.current.delete(id)
  }, [])

  const measure = useCallback((id: TourAnchorId) => {
    return new Promise<AnchorBox | null>((resolve) => {
      const view = views.current.get(id)
      if (!view) return resolve(null)
      // `measureInWindow`, not `measure`: the spotlight is an absolutely
      // positioned full-screen layer, so it needs window coordinates, and the
      // anchor's own parent chain is irrelevant to it.
      view.measureInWindow((x, y, width, height) => {
        if (width === 0 && height === 0) return resolve(null)
        resolve({ x, y, width, height })
      })
    })
  }, [])

  const value = useMemo(() => ({ measure, register }), [measure, register])
  return <TourAnchorContext.Provider value={value}>{children}</TourAnchorContext.Provider>
}

export function useTourAnchors(): TourAnchorRegistry {
  return useContext(TourAnchorContext)
}

/**
 * Wraps one element so the tour can find it. `collapsable={false}` is not
 * optional: without it Android's view flattening removes this View from the
 * native hierarchy entirely and `measureInWindow` answers with zeros.
 */
export function TourAnchor({ id, children }: { id: TourAnchorId; children: ReactNode }) {
  const { register } = useTourAnchors()
  return (
    <View collapsable={false} ref={(view) => register(id, view)}>
      {children}
    </View>
  )
}
