import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, ActivityIndicator, Image, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useImportSearch, type SearchProduct } from '@/src/hooks/useImportSearch';
import { formatPrice } from '@/src/lib/utils';

const PLATFORMS = [
  { id: 'amazon-fr',  label: 'Amazon 🇫🇷', currency: 'EUR' },
  { id: 'amazon-uk',  label: 'Amazon 🇬🇧', currency: 'GBP' },
  { id: 'amazon-ae',  label: 'Amazon 🇦🇪', currency: 'AED' },
  { id: 'amazon-de',  label: 'Amazon 🇩🇪', currency: 'EUR' },
  { id: 'ebay-fr',    label: 'eBay 🇫🇷',   currency: 'EUR' },
];

const { width: W } = Dimensions.get('window');
const CARD_W = (W - 32 - 10) / 2;

function ProductCard({ product, onPress }: { product: SearchProduct; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.card, { width: CARD_W }]} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.cardImg}>
        {product.image ? (
          <Image source={{ uri: product.image }} style={StyleSheet.absoluteFill as any} resizeMode="contain" />
        ) : (
          <Text style={styles.placeholder}>🛍️</Text>
        )}
        <View style={styles.flagBadge}>
          <Text style={{ fontSize: 12 }}>{product.platform_flag}</Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.priceText}>{formatPrice(product.price_dzd)}</Text>
        <Text style={styles.origPrice}>
          {product.price_original.toLocaleString('fr-FR', { style: 'currency', currency: product.currency })}
        </Text>
        <Text style={styles.titleText} numberOfLines={2}>{product.title}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function AbroadSearchScreen() {
  const router = useRouter();
  const { products, loading, error, searched, search } = useImportSearch();
  const [query,    setQuery]    = useState('');
  const [platform, setPlatform] = useState('amazon-fr');

  const handleSearch = () => {
    if (query.trim()) search(query, platform);
  };

  const handleSelect = (product: SearchProduct) => {
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
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Shop from Abroad</Text>
          <Text style={styles.headerSub}>استيراد مصغر</Text>
        </View>
      </View>

      {/* Platform selector */}
      <FlatList
        data={PLATFORMS}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.platformRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.platformChip, platform === item.id && styles.platformChipActive]}
            onPress={() => setPlatform(item.id)}
            activeOpacity={0.8}
          >
            <Text style={[styles.platformChipText, platform === item.id && styles.platformChipTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchInput}>
          <Ionicons name="search-outline" size={18} color="#9ca3af" />
          <TextInput
            style={styles.searchText}
            value={query}
            onChangeText={setQuery}
            placeholder="Search for any product…"
            placeholderTextColor="#9ca3af"
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={16} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.searchBtn, !query.trim() && { opacity: 0.5 }]}
          onPress={handleSearch}
          disabled={!query.trim() || loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.searchBtnText}>Go</Text>}
        </TouchableOpacity>
      </View>

      {/* Results */}
      {error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleSearch}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : !searched ? (
        <View style={styles.centered}>
          <Text style={{ fontSize: 48 }}>🛍️</Text>
          <Text style={styles.emptyTitle}>Search for anything</Text>
          <Text style={styles.emptySubtitle}>
            iPhone, PlayStation, cameras — if it's abroad, a verified traveler can bring it.
          </Text>
        </View>
      ) : loading ? null : products.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ fontSize: 36 }}>🔍</Text>
          <Text style={styles.emptyTitle}>No results found</Text>
          <Text style={styles.emptySubtitle}>Try different keywords or switch platform</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          numColumns={2}
          keyExtractor={(p) => p.id}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <ProductCard product={item} onPress={() => handleSelect(item)} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 16, backgroundColor: '#14532d',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 11, color: '#86efac', marginTop: 1 },

  platformRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  platformChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff',
  },
  platformChipActive: { borderColor: '#15803d', backgroundColor: '#f0fdf4' },
  platformChipText: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  platformChipTextActive: { color: '#15803d', fontWeight: '700' },

  searchRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 12 },
  searchInput: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1,
    borderColor: '#e5e7eb', paddingHorizontal: 12, paddingVertical: 10,
  },
  searchText: { flex: 1, fontSize: 14, color: '#111827' },
  searchBtn: {
    backgroundColor: '#15803d', borderRadius: 12,
    paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center',
  },
  searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  grid: { paddingHorizontal: 12, paddingBottom: 20 },
  row: { gap: 10, marginBottom: 10 },

  card: {
    borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb',
    backgroundColor: '#fff', overflow: 'hidden',
  },
  cardImg: {
    width: '100%', aspectRatio: 1, backgroundColor: '#f9fafb',
    alignItems: 'center', justifyContent: 'center',
  },
  placeholder: { fontSize: 32 },
  flagBadge: {
    position: 'absolute', top: 6, left: 6,
    backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 999,
    padding: 3,
  },
  cardBody: { padding: 8 },
  priceText: { fontSize: 14, fontWeight: '900', color: '#15803d' },
  origPrice: { fontSize: 10, color: '#9ca3af', marginBottom: 2 },
  titleText: { fontSize: 11, color: '#374151', lineHeight: 15, fontWeight: '500' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginTop: 12, marginBottom: 6, textAlign: 'center' },
  emptySubtitle: { fontSize: 13, color: '#9ca3af', textAlign: 'center', lineHeight: 18 },
  errorText: { fontSize: 14, color: '#ef4444', textAlign: 'center', marginBottom: 12 },
  retryBtn: { backgroundColor: '#15803d', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryBtnText: { color: '#fff', fontWeight: '700' },
});
