import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigationType } from 'react-router-dom'

interface SavedListState {
  y: number
  q: string
}

interface RestoreOptions {
  ready: boolean
  itemCount: number
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => unknown
}

/**
 * Remembers an infinite list's scroll position + search text in sessionStorage and
 * restores them when the user comes back with Back/Forward (a POP navigation).
 * Call this before the list query (it supplies the restored search text), then pass
 * its result to useRestoreListScroll once the query exists.
 */
export function useListScrollRestore(key: string) {
  const navType = useNavigationType()
  const storageKey = `mymdb:list:${key}`

  const [initial] = useState<SavedListState | null>(() => {
    if (navType !== 'POP') {
      sessionStorage.removeItem(storageKey)
      return null
    }
    try {
      const raw = sessionStorage.getItem(storageKey)
      return raw ? (JSON.parse(raw) as SavedListState) : null
    } catch {
      return null
    }
  })

  const stateRef = useRef<SavedListState>({ y: initial?.y ?? 0, q: initial?.q ?? '' })
  const pendingYRef = useRef<number | null>(initial && initial.y > 0 ? initial.y : null)

  const persist = useCallback(() => {
    sessionStorage.setItem(storageKey, JSON.stringify(stateRef.current))
  }, [storageKey])

  // Take over from the browser so it doesn't jump before the list renders
  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
  }, [])

  // Save the position while scrolling (ignored until any pending restore completes)
  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      if (pendingYRef.current !== null) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        stateRef.current.y = window.scrollY
        persist()
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
    }
  }, [persist])

  const rememberQuery = useCallback((q: string) => {
    if (stateRef.current.q === q) return
    stateRef.current = { y: 0, q }
    persist()
  }, [persist])

  return { initialQuery: initial?.q ?? '', rememberQuery, pendingYRef }
}

/**
 * Scrolls to the remembered position once enough content is on the page. If it's below
 * what's loaded (cache expired), keeps fetching pages until the content is tall enough.
 */
export function useRestoreListScroll(
  handle: ReturnType<typeof useListScrollRestore>,
  opts: RestoreOptions,
) {
  const { pendingYRef } = handle
  const { ready, itemCount, hasNextPage, isFetchingNextPage, fetchNextPage } = opts
  useEffect(() => {
    const target = pendingYRef.current
    if (target === null || !ready) return
    const maxY = document.documentElement.scrollHeight - window.innerHeight
    if (maxY >= target || !hasNextPage) {
      window.scrollTo(0, Math.min(target, Math.max(0, maxY)))
      pendingYRef.current = null
      return
    }
    if (!isFetchingNextPage) void fetchNextPage()
  }, [pendingYRef, ready, itemCount, hasNextPage, isFetchingNextPage, fetchNextPage])
}
