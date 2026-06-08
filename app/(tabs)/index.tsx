import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Dimensions,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SearchBar } from '@/components/SearchBar';
import { ListingCard } from '@/components/ListingCard';
import { CategoryGrid } from '@/components/CategoryGrid';
import { FilterSheet } from '@/components/FilterSheet';
import { EmptyState } from '@/components/EmptyState';
import { AppHeader } from '@/components/AppHeader';
import { useListings, fetchCategories } from '@/src/hooks/useListings';
import { useAuthStore } from '@/src/hooks/useAuth';
import { toggleFavorite } from '@/src/hooks/useFavorites';
import { supabase } from '@/src/lib/supabase';
import { ALGERIAN_CITIES } from '@/src/types';
import type { Category, Listing, ListingFilters } from '@/src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 24 * 2 - 8) / 2;

const FEATURED_SELECT = `*, seller:profiles!listings_seller_id_fkey(id, full_name, avatar_url, avg_rating, total_reviews, is_verified), category:categories(id, name, slug)`;

const VISIBLE_CITIES = ALGERIAN_CITIES.slice(0, 8);
const MORE_CITIES_COUNT = ALGERIAN_CITIES.length - VISIBLE_CITIES.length;

export default function HomeScreen() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);

  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<ListingFilters>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filterVisible, setFilterVisible] = useState(false);
  const [favorited, setFavorited] = useState<Set<string>>(new Set());
  const [featuredListings, setFeaturedListings] = useState<Listing[]>([]);

  const mergedFilters: ListingFilters = {
    ...filters,
    search: searchQuery || undefined,
    category_id: selectedCategory ?? undefined,
  };

  const { listings, loading, refreshing, hasMore, refresh, loadMore } = useListings(mergedFilters);

  useEffect(() => {
    fetchCategories().then(setCategories);
    supabase
      .from('listings')
      .select(FEATURED_SELECT)
      .eq('status', 'active')
      .eq('is_featured', true)
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => { if (data) setFeaturedListings(data as Listing[]); });
  }, []);

  useEffect(() => { refresh(); }, []);
  useEffect(() => { refresh(); }, [searchQuery, selectedCategory, JSON.stringify(filters)]);

  const handleFavoriteToggle = useCallback(async (listingId: string) => {
    if (!session?.user) return;
    const isFaved = favorited.has(listingId);
    setFavorited((prev) => {
      const next = new Set(prev);
      isFaved ? next.delete(listingId) : next.add(listingId);
      return next;
    });
    await toggleFavorite(listingId, session.user.id, isFaved);
  }, [session, favorited]);

  const renderListing = useCallback(({ item }: { item: Listing }) => (
    <View style={{ width: CARD_WIDTH }}>
      <ListingCard
        listing={item}
        isFavorited={favorited.has(item.id)}
        onFavoriteToggle={session ? handleFavoriteToggle : undefined}
      />
    </View>
  ), [favorited, session, handleFavoriteToggle]);

  const hasFilters = !!(
    filters.condition ||
    (filters.cities?.length ?? 0) > 0 ||
    filters.min_price ||
    filters.max_price ||
    searchQuery ||
    selectedCategory
  );

  const ListHeader = (
    <View>
      {/* ── Hero ── */}
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Buy. Sell. Connect.</Text>
        <Text style={styles.heroSubTitle}>Across Algeria.</Text>
        <Text style={styles.heroDesc}>
          Your trusted marketplace for amazing deals and real connections.
        </Text>
        <View style={styles.heroBtns}>
          <TouchableOpacity
            style={styles.heroExploreBtn}
            activeOpacity={0.85}
            onPress={() => { setSearchQuery(''); setSearch(''); setSelectedCategory(null); setFilters({}); }}
          >
            <Text style={styles.heroExploreBtnText}>Explore Now</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.heroSellBtn}
            activeOpacity={0.85}
            onPress={() => router.push('/(auth)/register')}
          >
            <Text style={styles.heroSellBtnText}>Start Selling</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Shop from Abroad banner ── */}
      {!hasFilters && (
        <TouchableOpacity
          style={styles.abroadBanner}
          activeOpacity={0.88}
          onPress={() => router.push('/abroad/search')}
        >
          <Text style={styles.abroadEmoji}>✈️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.abroadTitle}>Shop from Abroad</Text>
            <Text style={styles.abroadSub}>Amazon, eBay & more → delivered to Algeria</Text>
          </View>
          <View style={styles.abroadArrow}>
            <Ionicons name="arrow-forward" size={16} color="#15803d" />
          </View>
        </TouchableOpacity>
      )}

      {/* ── Active filter chips ── */}
      {hasFilters && (
        <View style={styles.activeFilters}>
          {searchQuery ? (
            <TouchableOpacity style={styles.chip} onPress={() => { setSearchQuery(''); setSearch(''); }}>
              <Text style={styles.chipText}>"{searchQuery}" ✕</Text>
            </TouchableOpacity>
          ) : null}
          {filters.condition && (
            <TouchableOpacity style={styles.chip} onPress={() => setFilters((p) => ({ ...p, condition: undefined }))}>
              <Text style={styles.chipText}>{filters.condition} ✕</Text>
            </TouchableOpacity>
          )}
          {filters.cities?.map((c) => (
            <TouchableOpacity key={c} style={styles.chip} onPress={() =>
              setFilters((p) => ({ ...p, cities: p.cities?.filter((x) => x !== c) }))
            }>
              <Text style={styles.chipText}>{c} ✕</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── All Categories ── */}
      {categories.length > 0 && !hasFilters && (
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>All Categories</Text>
            <TouchableOpacity
              style={styles.seeAll}
              onPress={() => router.push('/(tabs)/browse')}
            >
              <Text style={styles.seeAllText}>See all</Text>
              <Ionicons name="arrow-forward" size={12} color="#15803d" />
            </TouchableOpacity>
          </View>
          <CategoryGrid
            categories={categories}
            selectedId={selectedCategory}
            onSelect={(id) => { setSelectedCategory(id); setSearchQuery(''); setSearch(''); }}
          />
        </View>
      )}

      {/* ── Popular Cities ── */}
      {!hasFilters && (
        <View style={styles.section}>
          <Text style={styles.smallLabel}>Popular Cities</Text>
          <View style={styles.citiesWrap}>
            {VISIBLE_CITIES.map((city) => (
              <TouchableOpacity
                key={city}
                style={styles.cityChip}
                activeOpacity={0.7}
                onPress={() => setFilters((p) => ({ ...p, cities: [city] }))}
              >
                <Text style={styles.cityChipText}>{city}</Text>
              </TouchableOpacity>
            ))}
            {MORE_CITIES_COUNT > 0 && (
              <TouchableOpacity
                style={styles.moreCitiesChip}
                activeOpacity={0.7}
                onPress={() => setFilterVisible(true)}
              >
                <Text style={styles.moreCitiesText}>+ {MORE_CITIES_COUNT} more</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ── Featured Listings (2-col grid) ── */}
      {featuredListings.length > 0 && !hasFilters && (
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Featured Listings</Text>
            <TouchableOpacity style={styles.seeAll}>
              <Text style={styles.seeAllText}>See all</Text>
              <Ionicons name="arrow-forward" size={12} color="#15803d" />
            </TouchableOpacity>
          </View>
          <View style={styles.gridWrap}>
            {featuredListings.map((item) => (
              <View key={item.id} style={{ width: CARD_WIDTH }}>
                <ListingCard
                  listing={item}
                  isFavorited={favorited.has(item.id)}
                  onFavoriteToggle={session ? handleFavoriteToggle : undefined}
                />
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Section heading for main grid ── */}
      <View style={[styles.sectionRow, { marginBottom: 4 }]}>
        <Text style={styles.sectionTitle}>
          {hasFilters
            ? searchQuery ? `Results for "${searchQuery}"` : 'Listings'
            : 'Recommended for you'}
        </Text>
        {!hasFilters && (
          <TouchableOpacity style={styles.seeAll}>
            <Text style={styles.seeAllText}>View all</Text>
            <Ionicons name="arrow-forward" size={12} color="#15803d" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const CtaBanner = (
    <View style={styles.ctaBanner}>
      <Text style={styles.ctaTitle}>Ready to start selling?</Text>
      <Text style={styles.ctaSubtitle}>Join thousands of sellers across Algeria</Text>
      <TouchableOpacity
        style={styles.ctaBtn}
        activeOpacity={0.85}
        onPress={() => router.push('/(auth)/register')}
      >
        <Text style={styles.ctaBtnText}>Become a Seller</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />
      <SearchBar
        value={search}
        onChangeText={setSearch}
        onSubmit={() => setSearchQuery(search)}
        placeholder="Search items, categories or locations..."
      />
      <FlashList
        data={listings}
        renderItem={renderListing}
        keyExtractor={(item) => item.id}
        numColumns={2}
        estimatedItemSize={240}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          !loading ? (
            <EmptyState emoji="🛍️" title="No listings found" subtitle="Try adjusting your search or filters" />
          ) : null
        }
        ListFooterComponent={
          loading && listings.length > 0
            ? <ActivityIndicator color="#15803d" style={{ padding: 20 }} />
            : !hasFilters && listings.length > 0
              ? CtaBanner
              : null
        }
        refreshing={refreshing}
        onRefresh={refresh}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20 }}
      />

      {loading && listings.length === 0 && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#15803d" />
        </View>
      )}

      <FilterSheet
        visible={filterVisible}
        filters={filters}
        onApply={setFilters}
        onClose={() => setFilterVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },

  hero: {
    backgroundColor: '#14532d',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 28,
    marginHorizontal: -12,
  },
  heroTitle: { fontSize: 28, fontWeight: '900', color: '#fff' },
  heroSubTitle: { fontSize: 28, fontWeight: '900', color: '#86efac' },
  heroDesc: { fontSize: 13, color: '#bbf7d0', marginTop: 8, lineHeight: 19 },
  heroBtns: { flexDirection: 'row', gap: 10, marginTop: 20 },
  heroExploreBtn: {
    borderWidth: 1.5, borderColor: '#fff', borderRadius: 8,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  heroExploreBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  heroSellBtn: {
    backgroundColor: '#fff', borderRadius: 8,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  heroSellBtnText: { color: '#14532d', fontWeight: '700', fontSize: 14 },

  // Shop from Abroad banner
  abroadBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: -12, marginTop: 0,
    backgroundColor: '#f0fdf4', borderBottomWidth: 1, borderBottomColor: '#bbf7d0',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  abroadEmoji: { fontSize: 28 },
  abroadTitle: { fontSize: 15, fontWeight: '800', color: '#14532d' },
  abroadSub: { fontSize: 11, color: '#16a34a', marginTop: 1 },
  abroadArrow: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center',
  },

  section: { marginBottom: 4 },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  smallLabel: {
    fontSize: 13, fontWeight: '600', color: '#6b7280',
    paddingHorizontal: 16, paddingBottom: 10, paddingTop: 4,
  },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  seeAllText: { fontSize: 13, color: '#15803d', fontWeight: '500' },

  citiesWrap: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 12, gap: 8, paddingBottom: 8,
  },
  cityChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff',
  },
  cityChipText: { fontSize: 13, color: '#374151' },
  moreCitiesChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    borderWidth: 1, borderColor: '#86efac', backgroundColor: '#dcfce7',
  },
  moreCitiesText: { fontSize: 13, color: '#15803d', fontWeight: '600' },

  gridWrap: { flexDirection: 'row', flexWrap: 'wrap' },

  activeFilters: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 6, paddingHorizontal: 16, marginVertical: 8,
  },
  chip: {
    backgroundColor: '#dcfce7', borderRadius: 999, paddingHorizontal: 10,
    paddingVertical: 5, borderWidth: 1, borderColor: '#86efac',
  },
  chipText: { fontSize: 12, color: '#15803d', fontWeight: '500' },

  ctaBanner: {
    backgroundColor: '#14532d', borderRadius: 16, marginHorizontal: 4,
    marginTop: 16, marginBottom: 8, padding: 24, alignItems: 'center',
  },
  ctaTitle: { fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center' },
  ctaSubtitle: {
    fontSize: 13, color: '#bbf7d0', marginTop: 6, textAlign: 'center', lineHeight: 18,
  },
  ctaBtn: {
    backgroundColor: '#fff', borderRadius: 10,
    paddingHorizontal: 28, paddingVertical: 12, marginTop: 18,
  },
  ctaBtnText: { fontSize: 15, fontWeight: '700', color: '#14532d' },

  loader: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
});
