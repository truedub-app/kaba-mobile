import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Dimensions,
  TouchableOpacity, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppHeader } from '@/components/AppHeader';
import { SearchBar } from '@/components/SearchBar';
import { ListingCard } from '@/components/ListingCard';
import { useAuthStore } from '@/src/hooks/useAuth';
import { supabase } from '@/src/lib/supabase';
import type { Listing } from '@/src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 24 * 2 - 8) / 2;

interface Stats {
  totalViews: number;
  totalSaves: number;
  conversations: number;
  activeListings: number;
}

const STAT_CARDS = [
  { key: 'totalViews',    label: 'Total Views',      icon: 'eye-outline',        color: '#3b82f6', bg: '#eff6ff' },
  { key: 'totalSaves',    label: 'Total Saves',       icon: 'heart-outline',      color: '#ef4444', bg: '#fef2f2' },
  { key: 'conversations', label: 'Conversations',     icon: 'chatbubble-outline', color: '#15803d', bg: '#f0fdf4' },
  { key: 'activeListings',label: 'Active Listings',   icon: 'flash-outline',      color: '#f59e0b', bg: '#fffbeb' },
] as const;

export default function SellerDashboardScreen() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);

  const [stats, setStats] = useState<Stats>({
    totalViews: 0, totalSaves: 0, conversations: 0, activeListings: 0,
  });
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';

  const loadData = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    const userId = session.user.id;

    // Fetch all user listings (for views + list)
    const { data: myListings } = await supabase
      .from('listings')
      .select('id, views, status, title, price, images, city, condition, is_featured, created_at, seller_id, category_id, description, is_negotiable, origin_country, specifications, expires_at, updated_at')
      .eq('seller_id', userId)
      .order('created_at', { ascending: false });

    const listingRows = (myListings ?? []) as Listing[];
    const listingIds = listingRows.map((l) => l.id);
    const totalViews = listingRows.reduce((s, l) => s + (l.views ?? 0), 0);
    const activeListings = listingRows.filter((l) => l.status === 'active').length;

    // Saves count
    let totalSaves = 0;
    if (listingIds.length > 0) {
      const { count } = await supabase
        .from('favorites')
        .select('id', { count: 'exact', head: true })
        .in('listing_id', listingIds);
      totalSaves = count ?? 0;
    }

    // Conversations count (as seller)
    const { count: convCount } = await supabase
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', userId);

    setStats({ totalViews, totalSaves, conversations: convCount ?? 0, activeListings });
    setListings(listingRows);
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  if (!session) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <AppHeader />
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Sign in to view your dashboard</Text>
          <TouchableOpacity style={styles.greenBtn} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.greenBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />
      <SearchBar
        value=""
        onChangeText={() => {}}
        onSubmit={() => router.push('/(tabs)/browse')}
        placeholder="Search items, categories or locations..."
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* ── Dashboard header ── */}
        <View style={styles.dashHeader}>
          <View>
            <Text style={styles.dashTitle}>Seller Dashboard</Text>
            <Text style={styles.dashSub}>Welcome back, {firstName}</Text>
          </View>
          <TouchableOpacity style={styles.newListingBtn} activeOpacity={0.85}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.newListingText}>New Listing</Text>
          </TouchableOpacity>
        </View>

        {/* ── Stats grid ── */}
        {loading ? (
          <ActivityIndicator color="#15803d" style={{ marginVertical: 32 }} />
        ) : (
          <View style={styles.statsGrid}>
            {STAT_CARDS.map((card) => (
              <View key={card.key} style={styles.statCard}>
                <View style={[styles.statIconWrap, { backgroundColor: card.bg }]}>
                  <Ionicons name={card.icon as any} size={22} color={card.color} />
                </View>
                <Text style={styles.statNum}>{stats[card.key]}</Text>
                <Text style={styles.statLabel}>{card.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Your Listings ── */}
        <View style={styles.listingsCard}>
          <Text style={styles.listingsHeading}>Your Listings</Text>

          {loading ? (
            <ActivityIndicator color="#15803d" style={{ padding: 32 }} />
          ) : listings.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>You haven't posted any listings yet.</Text>
              <TouchableOpacity style={styles.createBtn} activeOpacity={0.85}>
                <Text style={styles.createBtnText}>Create your first listing</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.listingsGrid}>
              {listings.map((item) => (
                <View key={item.id} style={{ width: CARD_WIDTH }}>
                  <ListingCard listing={item} />
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  scroll: { paddingBottom: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },

  dashHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  dashTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  dashSub: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  newListingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#15803d',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  newListingText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    width: (SCREEN_WIDTH - 24 - 10) / 2,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    gap: 6,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statNum: { fontSize: 24, fontWeight: '800', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6b7280' },

  listingsCard: {
    marginHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  listingsHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
    gap: 16,
  },
  emptyText: { fontSize: 14, color: '#9ca3af', textAlign: 'center' },
  createBtn: {
    backgroundColor: '#15803d',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  listingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },

  emptyTitle: { fontSize: 16, color: '#374151', fontWeight: '600', textAlign: 'center' },
  greenBtn: {
    backgroundColor: '#15803d',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  greenBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
