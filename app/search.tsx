import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Image, Dimensions, Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '@/src/lib/supabase';
import { useImportSearch, type SearchProduct } from '@/src/hooks/useImportSearch';
import { useAbroadFavorites } from '@/src/hooks/useAbroadFavorites';
import { useAuthStore } from '@/src/hooks/useAuth';
import { ListingCard } from '@/components/ListingCard';
import { formatPrice } from '@/src/lib/utils';
import type { Listing } from '@/src/types';

/** Indeterminate loading bar with bilingual reassurance text. */
function AbroadLoadingBar() {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(x, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [x]);
  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [-90, 320] });
  return (
    <View style={styles.loadCard}>
      <View style={styles.loadHeader}>
        <ActivityIndicator size="small" color="#15803d" />
        <Text style={styles.loadTitle} numberOfLines={2}>
          نبحث لك عن أفضل المنتجات… | KABA is finding the best products for you
        </Text>
      </View>
      <View style={styles.loadTrack}>
        <Animated.View style={[styles.loadFill, { transform: [{ translateX }] }]} />
      </View>
    </View>
  );
}

const { width: W } = Dimensions.get('window');
const CARD_W = (W - 32 - 10) / 2;

export const COUNTRY_PLATFORMS = [
  { id: 'amazon-fr', flag: '🇫🇷', en: 'France',  ar: 'فرنسا' },
  { id: 'amazon-ae', flag: '🇦🇪', en: 'UAE',     ar: 'الإمارات' },
  { id: 'amazon-uk', flag: '🇬🇧', en: 'UK',      ar: 'بريطانيا' },
  { id: 'amazon-de', flag: '🇩🇪', en: 'Germany', ar: 'ألمانيا' },
  { id: 'ebay-fr',   flag: '🇫🇷', en: 'eBay',    ar: 'إيباي' },
] as const;

const LISTING_SELECT = `*, seller:profiles!listings_seller_id_fkey(id, full_name, avatar_url, avg_rating, total_reviews, is_verified), category:categories(id, name, slug)`;

function AbroadCard({ product, onPress, isFav, onToggleFav }: {
  product: SearchProduct; onPress: () => void; isFav: boolean; onToggleFav: () => void;
}) {
  return (
    <View style={[styles.card, { width: CARD_W }]}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.88}>
        <View style={styles.cardImg}>
          {product.image ? (
            <Image source={{ uri: product.image }} style={StyleSheet.absoluteFill as any} resizeMode="contain" />
          ) : (
            <Text style={{ fontSize: 32 }}>🛍️</Text>
          )}
          <View style={styles.flagBadge}>
            <Text style={{ fontSize: 12 }}>{product.platform_flag}</Text>
          </View>
          <TouchableOpacity
            style={styles.heartBtn}
            onPress={onToggleFav}
            hitSlop={8}
            activeOpacity={0.8}
          >
            <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={18} color={isFav ? '#ef4444' : '#6b7280'} />
          </TouchableOpacity>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.priceText}>{formatPrice(product.price_dzd)}</Text>
          <Text style={styles.origPrice}>
            {product.price_original.toLocaleString('fr-FR', { style: 'currency', currency: product.currency })}
          </Text>
          <Text style={styles.titleText} numberOfLines={2}>{product.title}</Text>
          {product.rating ? (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={11} color="#f59e0b" />
              <Text style={styles.ratingText}>
                {product.rating.toFixed(1)}
                {product.reviews_count ? ` (${product.reviews_count})` : ''}
              </Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.requestBtn} onPress={onPress} activeOpacity={0.85}>
        <Text style={styles.requestBtnText}>اطلب | Request</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function UnifiedSearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; platform?: string }>();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery]       = useState(params.q ?? '');
  const [platform, setPlatform] = useState(params.platform ?? 'amazon-fr');
  const [searched, setSearched] = useState(false);

  // Local results
  const [localResults, setLocalResults] = useState<Listing[]>([]);
  const [localLoading, setLocalLoading] = useState(false);

  // Abroad results
  const { products: abroadResults, loading: abroadLoading, error: abroadError, search: searchAbroad } = useImportSearch();

  // Saved abroad products
  const session = useAuthStore((s) => s.session);
  const { favUrls, toggle: toggleFav, refresh: refreshFavs } = useAbroadFavorites(session?.user?.id);
  useEffect(() => { refreshFavs(); }, [refreshFavs]);

  const runSearch = async (q: string, plat: string) => {
    const term = q.trim();
    if (!term) return;
    setSearched(true);

    // 1. Local listings (already in Algeria)
    setLocalLoading(true);
    supabase
      .from('listings')
      .select(LISTING_SELECT)
      .eq('status', 'active')
      .ilike('title', `%${term}%`)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setLocalResults((data ?? []) as Listing[]);
        setLocalLoading(false);
      });

    // 2. Abroad (ScraperAPI via web API)
    searchAbroad(term, plat);
  };

  // Auto-run when arriving with ?q= from home
  useEffect(() => {
    if (params.q?.trim()) runSearch(params.q, platform);
    else setTimeout(() => inputRef.current?.focus(), 350);
  }, []);

  const handleSubmit = () => runSearch(query, platform);

  const selectPlatform = (id: string) => {
    setPlatform(id);
    if (query.trim() && searched) runSearch(query, id);
  };

  const openAbroadProduct = (product: SearchProduct) => {
    router.push({
      pathname: '/abroad/product',
      params: {
        product_url:      product.product_url,
        product_title:    product.title,
        product_image:    product.image,
        product_platform: product.platform,
        price_original:   String(product.price_original),
        currency:         product.currency,
        price_dzd:        String(product.price_dzd),
        source_country:   product.source_country,
        flag:             product.platform_flag,
        rating:           product.rating ? String(product.rating) : '',
        reviews_count:    product.reviews_count ? String(product.reviews_count) : '',
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Search header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={styles.searchInput}>
          <Ionicons name="search-outline" size={18} color="#9ca3af" />
          <TextInput
            ref={inputRef}
            style={styles.searchText}
            value={query}
            onChangeText={setQuery}
            placeholder="ابحث عن منتج…  |  Search for a product…"
            placeholderTextColor="#9ca3af"
            returnKeyType="search"
            onSubmitEditing={handleSubmit}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={6}>
              <Ionicons name="close-circle" size={16} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Country chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
        style={{ flexGrow: 0 }}
      >
        {COUNTRY_PLATFORMS.map((c) => {
          const active = platform === c.id;
          return (
            <TouchableOpacity
              key={c.id}
              style={[styles.countryChip, active && styles.countryChipActive]}
              onPress={() => selectPlatform(c.id)}
              activeOpacity={0.8}
            >
              <Text style={styles.countryFlag}>{c.flag}</Text>
              <Text style={[styles.countryName, active && styles.countryNameActive]}>{c.en}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.results} showsVerticalScrollIndicator={false}>
        {!searched ? (
          <View style={styles.centered}>
            <Text style={{ fontSize: 44 }}>🔍</Text>
            <Text style={styles.emptyTitle}>ابحث عن أي منتج | Search for anything</Text>
            <Text style={styles.emptySubtitle}>
              We check sellers in Algeria first — then Amazon, eBay & more abroad.
            </Text>
          </View>
        ) : (
          <>
            {/* ── Available in Algeria ── */}
            {(localLoading || localResults.length > 0) && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>متوفر في الجزائر 🇩🇿 | Available in Algeria</Text>
                </View>
                {localLoading ? (
                  <ActivityIndicator color="#15803d" style={{ paddingVertical: 18 }} />
                ) : (
                  <View style={styles.grid}>
                    {localResults.map((item) => (
                      <View key={item.id} style={{ width: CARD_W }}>
                        <ListingCard listing={item} />
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* ── From Abroad ── */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>من الخارج ✈️ | From Abroad</Text>
                <Text style={styles.sectionSub}>
                  {COUNTRY_PLATFORMS.find((c) => c.id === platform)?.flag}{' '}
                  {COUNTRY_PLATFORMS.find((c) => c.id === platform)?.en}
                </Text>
              </View>

              {abroadLoading ? (
                <AbroadLoadingBar />
              ) : abroadError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{abroadError}</Text>
                  <TouchableOpacity style={styles.retryBtn} onPress={handleSubmit}>
                    <Text style={styles.retryBtnText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : abroadResults.length === 0 ? (
                <Text style={styles.noAbroad}>No abroad results — try another country tab above.</Text>
              ) : (
                <View style={styles.grid}>
                  {abroadResults.map((p) => (
                    <AbroadCard
                      key={p.id}
                      product={p}
                      onPress={() => openAbroadProduct(p)}
                      isFav={favUrls.has(p.product_url)}
                      onToggleFav={() => toggleFav(p)}
                    />
                  ))}
                </View>
              )}
            </View>
          </>
        )}
        <View style={{ height: 90 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  backBtn: { padding: 4 },
  searchInput: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f9fafb', borderRadius: 14, borderWidth: 1,
    borderColor: '#e5e7eb', paddingHorizontal: 12, paddingVertical: 10,
  },
  searchText: { flex: 1, fontSize: 14, color: '#111827' },

  chipsRow: { paddingHorizontal: 12, paddingBottom: 12, gap: 8, flexDirection: 'row' },
  countryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 15, paddingVertical: 9, borderRadius: 12,
    borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff',
  },
  countryChipActive: { borderColor: '#15803d', backgroundColor: '#f0fdf4' },
  countryFlag: { fontSize: 16 },
  countryName: { fontSize: 13.5, color: '#374151', fontWeight: '600' },
  countryNameActive: { color: '#15803d', fontWeight: '800' },

  results: { paddingHorizontal: 16 },
  centered: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#374151', marginTop: 14, textAlign: 'center' },
  emptySubtitle: { fontSize: 13, color: '#9ca3af', textAlign: 'center', lineHeight: 19, marginTop: 6 },

  section: { marginBottom: 8 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  sectionSub: { fontSize: 12, color: '#6b7280', fontWeight: '600' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  card: {
    borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb',
    backgroundColor: '#fff', overflow: 'hidden',
  },
  cardImg: {
    width: '100%', aspectRatio: 1, backgroundColor: '#f9fafb',
    alignItems: 'center', justifyContent: 'center',
  },
  flagBadge: {
    position: 'absolute', top: 6, left: 6,
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 999, padding: 3,
  },
  heartBtn: {
    position: 'absolute', top: 6, right: 6,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.95)', borderWidth: 1, borderColor: '#f3f4f6',
    alignItems: 'center', justifyContent: 'center',
  },
  cardBody: { padding: 9 },
  priceText: { fontSize: 14, fontWeight: '900', color: '#15803d' },
  origPrice: { fontSize: 10, color: '#9ca3af', marginBottom: 2 },
  titleText: { fontSize: 11.5, color: '#374151', lineHeight: 15, fontWeight: '500' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  ratingText: { fontSize: 11, color: '#6b7280', fontWeight: '600' },

  requestBtn: {
    backgroundColor: '#166534', marginHorizontal: 9, marginBottom: 9,
    borderRadius: 10, paddingVertical: 9, alignItems: 'center',
  },
  requestBtnText: { color: '#fff', fontWeight: '800', fontSize: 12.5 },

  loadingText: { fontSize: 12, color: '#9ca3af' },
  loadCard: {
    backgroundColor: '#f0fdf4', borderRadius: 14, borderWidth: 1, borderColor: '#bbf7d0',
    padding: 14, marginVertical: 4,
  },
  loadHeader: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 10 },
  loadTitle: { flex: 1, fontSize: 12.5, fontWeight: '700', color: '#166534', lineHeight: 17 },
  loadTrack: { height: 6, borderRadius: 999, backgroundColor: '#dcfce7', overflow: 'hidden' },
  loadFill: { width: 80, height: 6, borderRadius: 999, backgroundColor: '#15803d' },
  errorBox: { alignItems: 'center', paddingVertical: 18, gap: 10 },
  errorText: { fontSize: 13, color: '#ef4444', textAlign: 'center' },
  retryBtn: {
    backgroundColor: '#15803d', borderRadius: 10,
    paddingHorizontal: 20, paddingVertical: 9,
  },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  noAbroad: { fontSize: 13, color: '#9ca3af', paddingVertical: 14, textAlign: 'center' },
});
