import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/src/lib/supabase';
import type { UsedInternationalProduct } from '@/src/types';

const PAGE_SIZE = 12;

const ABROAD_SELECT = `
  *,
  contractor:profiles!used_international_products_contractor_id_fkey(
    id, full_name, username, avatar_url, avg_rating, total_reviews, is_verified
  ),
  trip:travel_trips(id, return_date, source_country, departure_date, status)
`;

interface AbroadFilters {
  country?: string;
  condition?: string;
}

export function useAbroadItems(filters: AbroadFilters = {}) {
  const [items, setItems]       = useState<UsedInternationalProduct[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore]   = useState(true);
  const offsetRef               = useRef(0);

  const load = useCallback(
    async (reset = false) => {
      if (!reset && !hasMore) return;

      if (reset) {
        setRefreshing(true);
        offsetRef.current = 0;
      } else {
        setLoading(true);
      }

      const offset = offsetRef.current;

      let query = supabase
        .from('used_international_products')
        .select(ABROAD_SELECT)
        .eq('status', 'available')
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (filters.country)   query = query.eq('source_country', filters.country);
      if (filters.condition) query = query.eq('condition', filters.condition);

      const { data, error } = await query;

      if (!error && data) {
        const rows = data as UsedInternationalProduct[];
        setItems((prev) => (reset ? rows : [...prev, ...rows]));
        offsetRef.current = offset + rows.length;
        setHasMore(rows.length === PAGE_SIZE);
      }

      setLoading(false);
      setRefreshing(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters.country, filters.condition, hasMore]
  );

  return {
    items,
    loading,
    refreshing,
    hasMore,
    refresh:  () => load(true),
    loadMore: () => load(false),
  };
}

/** Fetch a single product with full joins. */
export async function fetchAbroadItemById(
  id: string
): Promise<UsedInternationalProduct | null> {
  const { data } = await supabase
    .from('used_international_products')
    .select(
      `*, contractor:profiles!used_international_products_contractor_id_fkey(
        id, full_name, username, avatar_url, avg_rating, total_reviews, is_verified, bio
      ), trip:travel_trips(id, return_date, source_country, source_city, departure_date, status)`
    )
    .eq('id', id)
    .single();
  return data as UsedInternationalProduct | null;
}
