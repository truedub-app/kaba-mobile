import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Dimensions,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { SearchBar } from '@/components/SearchBar';
import { ListingCard } from '@/components/ListingCard';
import { CategoryGrid } from '@/components/CategoryGrid';
import { FilterSheet } from '@/components/FilterSheet';
import { EmptyState } from '@/components/EmptyState';
import { AppHeader } from '@/components/AppHeader';
import { useListings, fetchCategories } from '@/src/hooks/useListings';
import { useAuthStore } from '@/src/hooks/useAuth';
import { toggleFavorite } from '@/src/hooks/useFavorites';
import type { Category, Listing, ListingFilters } from '@/src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 24 * 2 - 8) / 2;

export default function BrowseScreen() {
  const session = useAuthStore((s) => s.session);
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<ListingFilters>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filterVisible, setFilterVisible] = useState(false);
  const [favorited, setFavorited] = useState<Set<string>>(new Set());

  const mergedFilters: ListingFilters = {
    ...filters,
    search: searchQuery || undefined,
    category_id: selectedCategory ?? undefined,
  };

  const { listings, loading, refreshing, refresh, loadMore } = useListings(mergedFilters);

  useEffect(() => { fetchCategories().then(setCategories); }, []);
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
      {/* ── Categories ── */}
      {categories.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>
              {selectedCategory ? 'Category' : 'All Categories'}
            </Text>
            {selectedCategory && (
              <TouchableOpacity
                onPress={() => setSelectedCategory(null)}
                style={styles.clearBtn}
              >
                <Text style={styles.clearBtnText}>Clear ✕</Text>
              </TouchableOpacity>
            )}
          </View>
          <CategoryGrid
            categories={categories}
            selectedId={selectedCategory}
            onSelect={(id) => { setSelectedCategory(id); setSearchQuery(''); setSearch(''); }}
          />
        </View>
      )}

      {/* ── Active chips ── */}
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

      <View style={[styles.sectionRow, { marginBottom: 4 }]}>
        <Text style={styles.sectionTitle}>
          {hasFilters
            ? searchQuery ? `Results for "${searchQuery}"` : 'Listings'
            : 'All Listings'}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <AppHeader />

      {/* Search */}
      <SearchBar
        value={search}
        onChangeText={setSearch}
        onSubmit={() => setSearchQuery(search)}
        placeholder="Search items, categories or locations..."
      />

      {/* Listings */}
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
  section: { marginBottom: 4 },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  clearBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#fee2e2' },
  clearBtnText: { fontSize: 12, color: '#ef4444', fontWeight: '500' },
  activeFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    marginVertical: 8,
  },
  chip: {
    backgroundColor: '#dcfce7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  chipText: { fontSize: 12, color: '#15803d', fontWeight: '500' },
  loader: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
});
