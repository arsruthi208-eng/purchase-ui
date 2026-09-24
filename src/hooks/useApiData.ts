import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Generic hook for fetching a list or single value from an async function.
 * Re-fetches when any value in `deps` changes.
 *
 * Usage:
 *   const { data: suppliers, reload } = useApiData(() => suppliersApi.list(), [])
 */
export function useApiData<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    fetcherRef.current()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reload, deps)

  return { data, loading, error, reload }
}

/**
 * Convenience hook that loads a list (never null — starts as []).
 */
export function useApiList<T>(fetcher: () => Promise<T[]>, deps: unknown[] = []) {
  const { data, loading, error, reload } = useApiData(fetcher, deps)
  return { data: data ?? [], loading, error, reload }
}
