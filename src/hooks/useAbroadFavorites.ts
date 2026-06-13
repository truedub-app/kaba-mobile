import { useState, useCallback } from 'react';
import { supabase } from '@/src/lib/supabase';
import type { SearchProduct } from '@/src/hooks/useImportSearch';

export interface AbroadFavorite {
  id: string;
  product_url: string;
  product_title: string;
  product_image: string | null;
  price_dzd: number | null;
  price_original: number | null;
  currency: string | null;
  platform: string | null;
  source_country: string | null;
}

/** Manage the buyer's saved abroad products (abroad_favorites table). */
export function useAbroadFavorites(userId: string | null | undefined) {
  const [favorites, setFavorites] = useState<AbroadFavorite[]>([]);
  const [favUrls, setFavUrls] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) { setFavorites([]); setFavUrls(new Set()); return; }
    setLoading(true);
    const { data } = await supabase
      .from('abroad_favorites')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    const rows = (data ?? []) as AbroadFavorite[];
    setFavorites(rows);
    setFavUrls(new Set(rows.map((r) => r.product_url)));
    setLoading(false);
  }, [userId]);

  const toggle = useCallback(async (product: SearchProduct) => {
    if (!userId) return;
    const isFav = favUrls.has(product.product_url);
    // optimistic
    setFavUrls((prev) => {
      const next = new Set(prev);
      isFav ? next.delete(product.product_url) : next.add(product.product_url);
      return next;
    });
    if (isFav) {
      await supabase.from('abroad_favorites').delete()
        .eq('user_id', userId).eq('product_url', product.product_url);
      setFavorites((prev) => prev.filter((f) => f.product_url !== product.product_url));
    } else {
      await supabase.from('abroad_favorites').upsert({
        user_id:        userId,
        product_url:    product.product_url,
        product_title:  product.title,
        product_image:  product.image,
        price_original: product.price_original,
        currency:       product.currency,
        price_dzd:      product.price_dzd,
        platform:       product.platform,
        source_country: product.source_country,
      }, { onConflict: 'user_id,product_url' });
    }
  }, [userId, favUrls]);

  return { favorites, favUrls, loading, refresh, toggle };
}
