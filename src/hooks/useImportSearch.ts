import { useState } from 'react';

const WEB_API = process.env.EXPO_PUBLIC_KABA_API_URL ?? 'https://dz-kaba.com';

export interface SearchProduct {
  id: string;
  title: string;
  image: string;
  price_original: number;
  currency: string;
  price_dzd: number;
  product_url: string;
  platform: string;
  source_country: string;
  platform_flag: string;
  rating?: number;
  reviews_count?: number;
}

export interface FullProduct extends SearchProduct {
  images: string[];
  description: string;
  variants?: { name: string; values: string[] }[];
}

export function useImportSearch() {
  const [products,  setProducts]  = useState<SearchProduct[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [searched,  setSearched]  = useState(false);

  const search = async (query: string, platform: string) => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const res  = await fetch(
        `${WEB_API}/api/search?q=${encodeURIComponent(query.trim())}&platform=${platform}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Search failed');
      setProducts(json.products ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProduct = async (productUrl: string) => {
    const res  = await fetch(`${WEB_API}/api/product?url=${encodeURIComponent(productUrl)}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Failed to fetch product');
    return json.product as FullProduct;
  };

  return { products, loading, error, searched, search, fetchProduct };
}
