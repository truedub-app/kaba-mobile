import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/src/lib/supabase';
import type { Listing, ListingFilters } from '@/src/types';

const PAGE_SIZE = 20;

const LISTING_SELECT = `
  *,
  seller:profiles!listings_seller_id_fkey(id, full_name, avatar_url, avg_rating, total_reviews, is_verified),
  category:categories(id, name, slug)
`;

export function useListings(filters: ListingFilters = {}) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const buildQuery = useCallback((offset: number) => {
    const f = filtersRef.current;
    let q = supabase
      .from('listings')
      .select(LISTING_SELECT)
      .eq('status', 'active')
      .range(offset, offset + PAGE_SIZE - 1);

    if (f.search) q = q.ilike('title', `%${f.search}%`);
    if (f.category_id) q = q.eq('category_id', f.category_id);
    if (f.condition) q = q.eq('condition', f.condition);
    if (f.min_price != null) q = q.gte('price', f.min_price);
    if (f.max_price != null) q = q.lte('price', f.max_price);
    if (f.cities?.length) q = q.in('city', f.cities);
    if (f.featured) q = q.eq('is_featured', true);
    if (f.available_now != null) q = q.eq('available_in_algeria', f.available_now);

    switch (f.sort) {
      case 'price_asc':
        q = q.order('price', { ascending: true });
        break;
      case 'price_desc':
        q = q.order('price', { ascending: false });
        break;
      case 'oldest':
        q = q.order('created_at', { ascending: true });
        break;
      default:
        q = q.order('created_at', { ascending: false });
    }

    return q;
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    pageRef.current = 0;
    const { data } = await buildQuery(0);
    const result = (data ?? []) as Listing[];
    setListings(result);
    setHasMore(result.length === PAGE_SIZE);
    pageRef.current = 1;
    setRefreshing(false);
  }, [buildQuery]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    const offset = pageRef.current * PAGE_SIZE;
    const { data } = await buildQuery(offset);
    const result = (data ?? []) as Listing[];
    setListings((prev) => [...prev, ...result]);
    setHasMore(result.length === PAGE_SIZE);
    pageRef.current += 1;
    setLoading(false);
  }, [loading, hasMore, buildQuery]);

  return { listings, loading, refreshing, hasMore, refresh, loadMore, setListings };
}

export async function fetchListingById(id: string): Promise<Listing | null> {
  const { data } = await supabase
    .from('listings')
    .select(`
      *,
      seller:profiles!listings_seller_id_fkey(
        id, full_name, avatar_url, avg_rating, total_reviews, is_verified,
        role, created_at, location, bio, whatsapp_number
      ),
      category:categories(id, name, slug, parent_id)
    `)
    .eq('id', id)
    .single();

  if (data) {
    // fire-and-forget view count increment
    supabase
      .from('listings')
      .update({ views: (data.views ?? 0) + 1 })
      .eq('id', id)
      .then(() => {});
  }

  return data as Listing | null;
}

export async function fetchRelatedListings(
  categoryId: string | null,
  excludeId: string
): Promise<Listing[]> {
  if (!categoryId) return [];
  const { data } = await supabase
    .from('listings')
    .select(LISTING_SELECT)
    .eq('category_id', categoryId)
    .eq('status', 'active')
    .neq('id', excludeId)
    .limit(6);
  return (data ?? []) as Listing[];
}

export async function fetchCategories() {
  const { data } = await supabase
    .from('categories')
    .select('*')
    .is('parent_id', null)
    .order('sort_order');
  return data ?? [];
}
