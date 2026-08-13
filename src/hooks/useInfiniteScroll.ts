import { useState, useCallback, useRef } from 'react';

interface UseInfiniteScrollOptions {
  initialPage?: number;
  initialData?: any[];
}

export const useInfiniteScroll = <T>(
  fetchFn: (page: number) => Promise<{ data: T[]; hasMore: boolean }>,
  options: UseInfiniteScrollOptions = {}
) => {
  const { initialPage = 1, initialData = [] } = options;

  const [data, setData] = useState<T[]>(initialData);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const inFlightRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (inFlightRef.current || loading || !hasMore) return;
    inFlightRef.current = true;

    setLoading(true);
    setError(null);

    try {
      const nextPage = page + 1;
      const result = await fetchFn(nextPage);
      setData(prev => [...prev, ...result.data]);
      setHasMore(result.hasMore);
      setPage(nextPage);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('An error occurred'));
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [fetchFn, loading, hasMore, page]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPage(initialPage);

    try {
      const result = await fetchFn(initialPage);
      setData(result.data);
      setHasMore(result.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('An error occurred'));
    } finally {
      setLoading(false);
    }
  }, [fetchFn, initialPage]);

  const reset = useCallback(() => {
    setData(initialData);
    setPage(initialPage);
    setHasMore(true);
    setError(null);
  }, [initialData, initialPage]);

  return {
    data,
    page,
    loading,
    hasMore,
    error,
    loadMore,
    refresh,
    reset,
    setData,
  };
};
