import { useState, useCallback } from 'react';
import { supabase } from '@/src/lib/supabase';
import type { Listing } from '@/src/types';

export function useFavorites(userId: string | null | undefined) {
  const [favorites, setFavorites] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setFavorites([]);
      return;
    }
    setRefreshing(true);
    const { data } = await supabase
      .from('favorites')
      .select(`
        id,
        listing:listings(
          *,
          seller:profiles!listings_seller_id_fkey(id, full_name, avatar_url, avg_rating, total_reviews, is_verified),
          category:categories(id, name, slug)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    const listings = (data ?? [])
      .map((f: any) => f.listing)
      .filter(Boolean) as Listing[];
    setFavorites(listings);
    setRefreshing(false);
  }, [userId]);

  const toggle = useCallback(
    async (listingId: string): Promise<boolean> => {
      if (!userId) return false;

      const isFaved = favorites.some((l) => l.id === listingId);

      if (isFaved) {
        setFavorites((prev) => prev.filter((l) => l.id !== listingId));
        await supabase
          .from('favorites')
          .delete()
          .eq('user_id', userId)
          .eq('listing_id', listingId);
        return false;
      } else {
        await supabase.from('favorites').insert({ user_id: userId, listing_id: listingId });
        return true;
      }
    },
    [userId, favorites]
  );

  const isFavorited = useCallback(
    (listingId: string) => favorites.some((l) => l.id === listingId),
    [favorites]
  );

  return { favorites, loading, refreshing, refresh, toggle, isFavorited };
}

export async function checkIsFavorited(
  listingId: string,
  userId: string | null | undefined
): Promise<boolean> {
  if (!userId) return false;
  const { data } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('listing_id', listingId)
    .maybeSingle();
  return !!data;
}

export async function toggleFavorite(
  listingId: string,
  userId: string,
  currentlyFavorited: boolean
): Promise<void> {
  if (currentlyFavorited) {
    await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('listing_id', listingId);
  } else {
    await supabase.from('favorites').insert({ user_id: userId, listing_id: listingId });
  }
}
