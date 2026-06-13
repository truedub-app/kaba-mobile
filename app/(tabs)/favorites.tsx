import React, { useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Dimensions,
  ScrollView, TouchableOpacity, Image, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ListingCard } from '@/components/ListingCard';
import { EmptyState } from '@/components/EmptyState';
import { useFavorites } from '@/src/hooks/useFavorites';
import { useAbroadFavorites } from '@/src/hooks/useAbroadFavorites';
import { useAuthStore } from '@/src/hooks/useAuth';
import { formatPrice } from '@/src/lib/utils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_WIDTH = (SCREEN_WIDTH - 16 * 2 - 10) / 2;

export default function FavoritesScreen() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const { favorites, refreshing, refresh, toggle } = useFavorites(session?.user?.id);
  const { favorites: abroadFavs, refresh: refreshAbroad } = useAbroadFavorites(session?.user?.id);

  useFocusEffect(useCallback(() => {
    refresh();
    refreshAbroad();
  }, [session?.user?.id, refreshAbroad]));

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.header}>Saved</Text>
        <EmptyState
          emoji="🔐"
          title="Sign in to save listings"
          subtitle="Your saved items will appear here"
          actionLabel="Sign In"
          onAction={() => router.push('/(auth)/login')}
        />
      </SafeAreaView>
    );
  }

  const isEmpty = favorites.length === 0 && abroadFavs.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.header}>Saved</Text>
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { refresh(); refreshAbroad(); }} />
        }
      >
        {/* Saved abroad products */}
        {abroadFavs.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>من الخارج ✈️ | Saved from Abroad</Text>
            <View style={styles.grid}>
              {abroadFavs.map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.abroadCard, { width: COLUMN_WIDTH }]}
                  activeOpacity={0.88}
                  onPress={() => router.push({
                    pathname: '/abroad/product',
                    params: {
                      product_url: f.product_url, product_title: f.product_title,
                      product_image: f.product_image ?? '', product_platform: f.platform ?? '',
                      price_original: String(f.price_original ?? ''), currency: f.currency ?? 'EUR',
                      price_dzd: String(f.price_dzd ?? ''), source_country: f.source_country ?? '',
                    },
                  })}
                >
                  <View style={styles.abroadImg}>
                    {f.product_image ? (
                      <Image source={{ uri: f.product_image }} style={StyleSheet.absoluteFill as any} resizeMode="contain" />
                    ) : <Text style={{ fontSize: 28 }}>🛍️</Text>}
                  </View>
                  <View style={{ padding: 8 }}>
                    {f.price_dzd != null && <Text style={styles.abroadPrice}>{formatPrice(f.price_dzd)}</Text>}
                    <Text style={styles.abroadTitle} numberOfLines={2}>{f.product_title}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Saved local listings */}
        {favorites.length > 0 && (
          <>
            {abroadFavs.length > 0 && <Text style={styles.sectionTitle}>متوفر في الجزائر 🇩🇿 | Local Listings</Text>}
            <View style={styles.grid}>
              {favorites.map((item) => (
                <View key={item.id} style={{ width: COLUMN_WIDTH }}>
                  <ListingCard listing={item} isFavorited onFavoriteToggle={async (id) => { await toggle(id); }} />
                </View>
              ))}
            </View>
          </>
        )}

        {isEmpty && !refreshing && (
          <EmptyState
            emoji="❤️"
            title="No saved items yet"
            subtitle="Tap the heart on any listing or abroad product to save it"
            actionLabel="Browse"
            onAction={() => router.push('/(tabs)')}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#111827', marginTop: 8, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  abroadCard: { borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', overflow: 'hidden' },
  abroadImg: { width: '100%', aspectRatio: 1, backgroundColor: '#f9fafb', alignItems: 'center', justifyContent: 'center' },
  abroadPrice: { fontSize: 14, fontWeight: '900', color: '#15803d' },
  abroadTitle: { fontSize: 11.5, color: '#374151', lineHeight: 15, fontWeight: '500', marginTop: 2 },
});
