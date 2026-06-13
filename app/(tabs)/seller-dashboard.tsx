import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, Alert, Image, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppHeader } from '@/components/AppHeader';
import { SearchBar } from '@/components/SearchBar';
import { useAuthStore } from '@/src/hooks/useAuth';
import { supabase } from '@/src/lib/supabase';
import { formatPrice } from '@/src/lib/utils';
import type { Listing } from '@/src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Stats {
  orderRequests: number;
  totalViews: number;
  totalSaves: number;
  conversations: number;
  activeListings: number;
}

const STAT_CARDS = [
  { key: 'orderRequests',  label: 'Order Requests', icon: 'bag-handle-outline', color: '#15803d', bg: '#f0fdf4', href: '/contractor/orders' as const },
  { key: 'totalViews',     label: 'Total Views',    icon: 'eye-outline',        color: '#3b82f6', bg: '#eff6ff' },
  { key: 'totalSaves',     label: 'Total Saves',    icon: 'heart-outline',      color: '#ef4444', bg: '#fef2f2' },
  { key: 'conversations',  label: 'Conversations',  icon: 'chatbubble-outline', color: '#15803d', bg: '#f0fdf4' },
  { key: 'activeListings', label: 'Active',         icon: 'flash-outline',      color: '#f59e0b', bg: '#fffbeb' },
] as const;

const STATUS_COLOR: Record<string, string> = {
  active: '#15803d',
  sold: '#6b7280',
  pending: '#f59e0b',
  rejected: '#ef4444',
};

export default function SellerDashboardScreen() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);

  const [stats, setStats] = useState<Stats>({ orderRequests: 0, totalViews: 0, totalSaves: 0, conversations: 0, activeListings: 0 });
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';

  const loadData = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    const userId = session.user.id;

    const { data: myListings } = await supabase
      .from('listings')
      .select('id, views, status, title, price, images, city, condition, is_featured, created_at, seller_id, category_id, description, is_negotiable, origin_country, specifications, expires_at, updated_at')
      .eq('seller_id', userId)
      .order('created_at', { ascending: false });

    const listingRows = (myListings ?? []) as Listing[];
    const listingIds = listingRows.map((l) => l.id);
    const totalViews = listingRows.reduce((s, l) => s + (l.views ?? 0), 0);
    const activeListings = listingRows.filter((l) => l.status === 'active').length;

    let totalSaves = 0;
    if (listingIds.length > 0) {
      const { count } = await supabase
        .from('favorites')
        .select('id', { count: 'exact', head: true })
        .in('listing_id', listingIds);
      totalSaves = count ?? 0;
    }

    const { count: convCount } = await supabase
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', userId);

    // New import order requests awaiting the seller's action (deposit paid)
    const { count: reqCount } = await supabase
      .from('import_requests')
      .select('id', { count: 'exact', head: true })
      .eq('contractor_id', userId)
      .eq('status', 'deposit_held');

    setStats({ orderRequests: reqCount ?? 0, totalViews, totalSaves, conversations: convCount ?? 0, activeListings });
    setListings(listingRows);
    setLoading(false);
  }, [session?.user?.id]);

  // Reload whenever the screen comes into focus (after create/edit/delete)
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleNewListing = () => {
    if (!session) { router.push('/(auth)/login'); return; }
    if (profile?.role === 'seller' || profile?.role === 'admin') {
      router.push('/listing/create');
    } else if (profile?.seller_status === 'pending') {
      Alert.alert('Application Pending', 'Your seller application is under review. We\'ll notify you once approved.');
    } else {
      router.push('/seller/apply');
    }
  };

  const executeDelete = async (item: Listing) => {
    setDeletingId(item.id);
    setConfirmDeleteId(null);
    try {
      // Use live getUser() — never rely on cached Zustand session for mutations
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) {
        Alert.alert('Signed Out', 'Your session expired. Please sign in again.');
        router.push('/(auth)/login');
        return;
      }
      const { data: deleted, error } = await supabase
        .from('listings')
        .delete()
        .eq('id', item.id)
        .select('id');
      if (error) {
        Alert.alert('Delete Failed', error.message);
      } else if (!deleted?.length) {
        Alert.alert('Delete Failed', `uid=${user.id.slice(0,8)} | seller=${item.id.slice(0,8)} — RLS blocked. Ensure your account matches the listing owner.`);
      } else {
        setListings((prev) => prev.filter((l) => l.id !== item.id));
        setStats((prev) => ({
          ...prev,
          activeListings: item.status === 'active' ? prev.activeListings - 1 : prev.activeListings,
        }));
      }
    } finally {
      setDeletingId(null);
    }
  };

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
          <View style={{ flex: 1 }}>
            <Text style={styles.dashTitle}>Seller Dashboard</Text>
            <Text style={styles.dashSub}>Welcome back, {firstName}</Text>
            <TouchableOpacity
              style={styles.editProfileBtn}
              activeOpacity={0.7}
              onPress={() => router.push('/profile')}
            >
              <Ionicons name="person-circle-outline" size={15} color="#15803d" />
              <Text style={styles.editProfileText}>تعديل الملف الشخصي | Edit Profile</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.newListingBtn} activeOpacity={0.85} onPress={handleNewListing}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.newListingText}>New Listing</Text>
          </TouchableOpacity>
        </View>

        {/* ── Stats grid ── */}
        {loading ? (
          <ActivityIndicator color="#15803d" style={{ marginVertical: 32 }} />
        ) : (
          <View style={styles.statsGrid}>
            {STAT_CARDS.map((card) => {
              const href = 'href' in card ? card.href : undefined;
              const count = stats[card.key];
              const inner = (
                <>
                  <View style={[styles.statIconWrap, { backgroundColor: card.bg }]}>
                    <Ionicons name={card.icon as any} size={22} color={card.color} />
                    {href && count > 0 && (
                      <View style={styles.statBadge}>
                        <Text style={styles.statBadgeText}>{count > 9 ? '9+' : count}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.statNum}>{count}</Text>
                  <Text style={styles.statLabel}>{card.label}</Text>
                </>
              );
              return href ? (
                <TouchableOpacity
                  key={card.key}
                  style={[styles.statCard, count > 0 && styles.statCardActive]}
                  activeOpacity={0.85}
                  onPress={() => router.push(href)}
                >
                  {inner}
                </TouchableOpacity>
              ) : (
                <View key={card.key} style={styles.statCard}>{inner}</View>
              );
            })}
          </View>
        )}

        {/* ── Micro-Import Manager ── */}
        <View style={styles.importCard}>
          <View style={styles.importHeader}>
            <Text style={styles.importTitle}>✈️ Micro-Import Manager</Text>
            <Text style={styles.importSubtitle}>
              Sell items you find abroad — register trips &amp; post listings
            </Text>
          </View>
          <View style={styles.importBtns}>
            <TouchableOpacity
              style={[styles.importBtn, styles.importBtnGreen]}
              activeOpacity={0.85}
              onPress={() => router.push('/trips')}
            >
              <Ionicons name="airplane-outline" size={18} color="#fff" />
              <Text style={styles.importBtnTextWhite}>My Trips</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.importBtn, styles.importBtnOutline]}
              activeOpacity={0.85}
              onPress={() => router.push('/contractor/orders')}
            >
              <Ionicons name="cube-outline" size={18} color="#15803d" />
              <Text style={styles.importBtnText}>My Deliveries</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Your Listings ── */}
        <View style={styles.listingsCard}>
          <Text style={styles.listingsHeading}>Your Listings</Text>

          {loading ? (
            <ActivityIndicator color="#15803d" style={{ padding: 32 }} />
          ) : listings.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="storefront-outline" size={40} color="#d1d5db" />
              <Text style={styles.emptyText}>You haven't posted any listings yet.</Text>
              <TouchableOpacity style={styles.createBtn} activeOpacity={0.85} onPress={handleNewListing}>
                <Text style={styles.createBtnText}>Create your first listing</Text>
              </TouchableOpacity>
            </View>
          ) : (
            listings.map((item) => (
              <View key={item.id} style={styles.listingRow}>
                {/* Thumbnail */}
                <TouchableOpacity onPress={() => router.push(`/listing/${item.id}`)}>
                  {item.images?.[0] ? (
                    <Image source={{ uri: item.images[0] }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbPlaceholder]}>
                      <Ionicons name="image-outline" size={24} color="#d1d5db" />
                    </View>
                  )}
                </TouchableOpacity>

                {/* Info */}
                <TouchableOpacity
                  style={styles.listingInfo}
                  onPress={() => router.push(`/listing/${item.id}`)}
                >
                  <Text style={styles.listingTitle} numberOfLines={2}>{item.title}</Text>
                  <View style={styles.listingMeta}>
                    <Text style={styles.listingPrice}>{formatPrice(item.price)}</Text>
                    <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[item.status] ?? '#9ca3af' }]} />
                    <Text style={[styles.statusText, { color: STATUS_COLOR[item.status] ?? '#9ca3af' }]}>
                      {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </Text>
                    {item.is_featured && (
                      <View style={styles.featuredBadge}>
                        <Ionicons name="flash" size={10} color="#d97706" />
                        <Text style={styles.featuredText}>Boosted</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>

                {/* Actions */}
                <View style={styles.actions}>
                  {confirmDeleteId === item.id ? (
                    // Two-tap confirm — no Alert.alert needed (works on web + native)
                    <>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnDelete]}
                        onPress={() => executeDelete(item)}
                        disabled={deletingId === item.id}
                      >
                        {deletingId === item.id
                          ? <ActivityIndicator size="small" color="#ef4444" />
                          : <Ionicons name="checkmark" size={18} color="#ef4444" />}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => setConfirmDeleteId(null)}
                      >
                        <Ionicons name="close" size={18} color="#374151" />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => router.push(`/listing/edit/${item.id}`)}
                      >
                        <Ionicons name="create-outline" size={18} color="#374151" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnBoost]}
                        onPress={() => router.push(`/listing/boost/${item.id}`)}
                      >
                        <Ionicons name="flash-outline" size={18} color="#d97706" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnDelete]}
                        onPress={() => setConfirmDeleteId(item.id)}
                      >
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            ))
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16,
  },
  dashTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  dashSub: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  newListingBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#15803d', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  newListingText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 12, gap: 10, marginBottom: 16,
  },
  statCard: {
    width: (SCREEN_WIDTH - 24 - 10) / 2,
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#e5e7eb', padding: 16, gap: 6,
  },
  statCardActive: { borderColor: '#15803d', backgroundColor: '#f0fdf4' },
  statIconWrap: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  statBadge: {
    position: 'absolute', top: -5, right: -5,
    minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#ef4444',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  statBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  statNum: { fontSize: 24, fontWeight: '800', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6b7280' },

  importCard: {
    marginHorizontal: 12, marginBottom: 12,
    borderRadius: 14, borderWidth: 1, borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4', padding: 14,
  },
  importHeader: { marginBottom: 12 },
  importTitle: { fontSize: 15, fontWeight: '800', color: '#14532d', marginBottom: 2 },
  importSubtitle: { fontSize: 12, color: '#16a34a' },
  importBtns: { flexDirection: 'row', gap: 8 },
  importBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#15803d', backgroundColor: '#fff',
  },
  importBtnGreen:   { backgroundColor: '#15803d', borderColor: '#15803d' },
  importBtnOutline: { backgroundColor: '#fff', borderColor: '#15803d' },
  importBtnText:      { fontSize: 13, fontWeight: '700', color: '#15803d' },
  importBtnTextWhite: { fontSize: 13, fontWeight: '700', color: '#fff' },

  editProfileBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', marginTop: 6,
  },
  editProfileText: { fontSize: 12, fontWeight: '700', color: '#15803d' },

  listingsCard: {
    marginHorizontal: 12, borderRadius: 14,
    borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden',
  },
  listingsHeading: {
    fontSize: 15, fontWeight: '700', color: '#111827',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  emptyBox: {
    alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24, gap: 12,
  },
  emptyText: { fontSize: 14, color: '#9ca3af', textAlign: 'center' },
  createBtn: {
    backgroundColor: '#15803d', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 13,
  },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  /* Listing row */
  listingRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
    gap: 10,
  },
  thumb: { width: 60, height: 60, borderRadius: 10 },
  thumbPlaceholder: { backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  listingInfo: { flex: 1, gap: 4 },
  listingTitle: { fontSize: 13, fontWeight: '600', color: '#111827', lineHeight: 18 },
  listingMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  listingPrice: { fontSize: 13, fontWeight: '700', color: '#15803d' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '600' },
  featuredBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: '#fef3c7', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2,
  },
  featuredText: { fontSize: 10, color: '#d97706', fontWeight: '700' },

  actions: { flexDirection: 'row', gap: 4 },
  actionBtn: {
    width: 34, height: 34, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  actionBtnBoost: { borderColor: '#fde68a', backgroundColor: '#fffbeb' },
  actionBtnDelete: { borderColor: '#fecaca', backgroundColor: '#fef2f2' },

  emptyTitle: { fontSize: 16, color: '#374151', fontWeight: '600', textAlign: 'center' },
  greenBtn: { backgroundColor: '#15803d', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  greenBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
