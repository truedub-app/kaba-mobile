import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Dimensions, Image,
  TouchableOpacity, ActivityIndicator, ScrollView,
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
import { getAvatarUrl } from '@/src/lib/utils';
import { countryFlag } from '@/src/types';
import type { Category, Listing, ListingFilters, TravelTrip, Profile } from '@/src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 24 * 2 - 8) / 2;

const FEATURED_SELECT = `*, seller:profiles!listings_seller_id_fkey(id, full_name, avatar_url, avg_rating, total_reviews, is_verified), category:categories(id, name, slug)`;

type TripWithContractor = TravelTrip & { contractor: Profile | null };

function daysUntil(dateStr: string): number {
  const ms = new Date(`${dateStr}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export default function HomeScreen() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ListingFilters>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filterVisible, setFilterVisible] = useState(false);
  const [favorited, setFavorited] = useState<Set<string>>(new Set());
  const [featuredListings, setFeaturedListings] = useState<Listing[]>([]);
  const [travelers, setTravelers] = useState<TripWithContractor[]>([]);

  const mergedFilters: ListingFilters = {
    ...filters,
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

    // Featured travelers (active trips, soonest return first)
    const today = new Date().toISOString().split('T')[0];
    supabase
      .from('travel_trips')
      .select('*, contractor:profiles!travel_trips_user_id_fkey(id, full_name, avatar_url, is_verified, avg_rating)')
      .eq('status', 'active')
      .gte('return_date', today)
      .order('return_date')
      .limit(10)
      .then(({ data }) => { if (data) setTravelers(data as TripWithContractor[]); });
  }, []);

  useEffect(() => { refresh(); }, []);
  useEffect(() => { refresh(); }, [selectedCategory, JSON.stringify(filters)]);

  const goSearch = (q?: string, platform?: string) => {
    const params: Record<string, string> = {};
    if (q?.trim()) params.q = q.trim();
    if (platform) params.platform = platform;
    router.push({ pathname: '/search', params });
  };

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
    selectedCategory
  );

  const ListHeader = (
    <View>
      {/* ── Featured Travelers ── */}
      {travelers.length > 0 && !hasFilters && (
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>مسافرون مميزون | Featured Travelers</Text>
            <TouchableOpacity style={styles.seeAll} onPress={() => goSearch()}>
              <Text style={styles.seeAllText}>عرض الكل | View all</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.travelersRow}
          >
            {travelers.map((trip) => {
              const c = trip.contractor;
              const days = daysUntil(trip.return_date);
              const avatarUrl = c?.avatar_url ? getAvatarUrl(c.avatar_url) : null;
              return (
                <TouchableOpacity
                  key={trip.id}
                  style={styles.travelerCard}
                  activeOpacity={0.85}
                  onPress={() => goSearch()}
                >
                  <View style={styles.travelerAvatarWrap}>
                    {avatarUrl ? (
                      <Image source={{ uri: avatarUrl }} style={styles.travelerAvatar} />
                    ) : (
                      <View style={[styles.travelerAvatar, styles.travelerAvatarFallback]}>
                        <Text style={styles.travelerInitial}>
                          {(c?.full_name ?? '؟').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.travelerFlag}>
                      <Text style={{ fontSize: 13 }}>
                        {countryFlag(trip.source_country)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.travelerName} numberOfLines={1}>
                    {(c?.full_name ?? 'Traveler').split(' ')[0]}
                  </Text>
                  <Text style={styles.travelerEtaAr}>قادم خلال {days} أيام</Text>
                  <Text style={styles.travelerEtaEn}>Coming in {days} days</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── Active filter chips ── */}
      {hasFilters && (
        <View style={styles.activeFilters}>
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
          {selectedCategory && (
            <TouchableOpacity style={styles.chip} onPress={() => setSelectedCategory(null)}>
              <Text style={styles.chipText}>Category ✕</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Product Categories ── */}
      {categories.length > 0 && !hasFilters && (
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>فئات المنتجات | Product Categories</Text>
            <TouchableOpacity
              style={styles.seeAll}
              onPress={() => router.push('/(tabs)/browse')}
            >
              <Text style={styles.seeAllText}>عرض الكل | View all</Text>
            </TouchableOpacity>
          </View>
          <CategoryGrid
            categories={categories.slice(0, 9)}
            selectedId={selectedCategory}
            onSelect={(id) => { setSelectedCategory(id); }}
          />
        </View>
      )}

      {/* ── Featured Listings ── */}
      {featuredListings.length > 0 && !hasFilters && (
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>منتجات مميزة | Featured Products</Text>
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
          {hasFilters ? 'النتائج | Results' : 'منتجات متاحة | Available Products'}
        </Text>
        {!hasFilters && (
          <TouchableOpacity style={styles.seeAll} onPress={() => router.push('/(tabs)/browse')}>
            <Text style={styles.seeAllText}>عرض الكل | View all</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const CtaBanner = (
    <View style={styles.ctaBanner}>
      <Text style={styles.ctaTitle}>جاهز للبيع؟ | Ready to start selling?</Text>
      <Text style={styles.ctaSubtitle}>Join thousands of sellers across Algeria</Text>
      <TouchableOpacity
        style={styles.ctaBtn}
        activeOpacity={0.85}
        onPress={() => router.push('/(auth)/register')}
      >
        <Text style={styles.ctaBtnText}>كن بائعاً | Become a Seller</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />
      <SearchBar
        value={search}
        onChangeText={setSearch}
        onSubmit={() => { if (search.trim()) { goSearch(search); setSearch(''); } }}
        placeholder="ابحث عن منتج…  |  Search for a product…"
      />
      <FlashList
        data={listings}
        renderItem={renderListing}
        keyExtractor={(item) => item.id}
        numColumns={2}
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

  // Featured travelers
  travelersRow: { paddingHorizontal: 14, gap: 16, flexDirection: 'row', paddingBottom: 6 },
  travelerCard: { alignItems: 'center', width: 86 },
  travelerAvatarWrap: { position: 'relative' },
  travelerAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#f3f4f6' },
  travelerAvatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#dcfce7' },
  travelerInitial: { fontSize: 24, fontWeight: '800', color: '#15803d' },
  travelerFlag: {
    position: 'absolute', bottom: -2, right: -2,
    backgroundColor: '#fff', borderRadius: 999, padding: 2,
    borderWidth: 1, borderColor: '#f3f4f6',
  },
  travelerName: { fontSize: 13, fontWeight: '700', color: '#111827', marginTop: 6 },
  travelerEtaAr: { fontSize: 10.5, color: '#16a34a', fontWeight: '700', marginTop: 2 },
  travelerEtaEn: { fontSize: 10, color: '#6b7280' },

  section: { marginBottom: 4 },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  seeAllText: { fontSize: 12, color: '#15803d', fontWeight: '700' },

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
  ctaTitle: { fontSize: 18, fontWeight: '800', color: '#fff', textAlign: 'center' },
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
