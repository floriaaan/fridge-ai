import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useConnector } from '../shared/connector-context.js'
import { mergeScanItems } from '../../domain/fridge/fridge-scan-merge.js'
import type { FridgeScanDraftItem } from '../../domain/fridge/fridge-scan-draft.js'
import type { ApiError } from '../../domain/shared/api-error.js'

export type PhotoScanState =
  | { status: 'pending' }
  | { status: 'running' }
  | { status: 'done'; items: FridgeScanDraftItem[] }
  | { status: 'failed'; error: ApiError }

/**
 * One `scanFridgePhoto` call per photo, run one at a time — never crashes the
 * whole batch on a single bad shot: each photo keeps its own state, and the
 * others still run. Stops early only on `provider_not_configured`, since
 * that failure is guaranteed to repeat on every remaining photo too.
 */
export function useFridgeScan(imageUris: string[]) {
  const connector = useConnector()
  const [states, setStates] = useState<PhotoScanState[]>(() => imageUris.map(() => ({ status: 'pending' })))
  const runningRef = useRef(false)

  const runOne = useCallback(
    async (index: number) => {
      setStates((current) => current.map((s, i) => (i === index ? { status: 'running' } : s)))
      const result = await connector.scanFridgePhoto(imageUris[index])
      setStates((current) =>
        current.map((s, i) =>
          i === index ? (result.ok ? { status: 'done', items: result.value.items } : { status: 'failed', error: result.error }) : s,
        ),
      )
      return result
    },
    [connector, imageUris],
  )

  const runAll = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    try {
      for (let index = 0; index < imageUris.length; index++) {
        const result = await runOne(index)
        if (!result.ok && result.error.type === 'provider_not_configured') break
      }
    } finally {
      runningRef.current = false
    }
  }, [imageUris.length, runOne])

  useEffect(() => {
    runAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const retry = useCallback((index: number) => runOne(index), [runOne])

  const done = states.every((s) => s.status === 'done' || s.status === 'failed')
  // Memoized: the review screen seeds its editable list from `items` in an
  // effect, so a fresh array every render re-ran that effect forever.
  const items = useMemo(() => mergeScanItems(states.flatMap((s) => (s.status === 'done' ? s.items : []))), [states])
  const blockedByProvider = states.some((s) => s.status === 'failed' && s.error.type === 'provider_not_configured')

  return { states, items, done, blockedByProvider, retry }
}
