import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '@/src/lib/supabase';
import { useAuthStore } from '@/src/hooks/useAuth';
import { formatPrice } from '@/src/lib/utils';
import { STATUS_LABELS } from '@/src/types';
import type { ImportRequest, ImportRequestStatus } from '@/src/types';

const STATUS_STYLE: Record<ImportRequestStatus, { bg: string; text: string }> = {
  pending_deposit:       { bg: '#f3f4f6', text: '#6b7280' },
  awaiting_verification: { bg: '#fef3c7', text: '#b45309' },
  deposit_held:          { bg: '#dbeafe', text: '#1d4ed8' },
  in_transit:            { bg: '#ede9fe', text: '#6d28d9' },
  released_to_seller:    { bg: '#dcfce7', text: '#15803d' },
  disputed:              { bg: '#fee2e2', text: '#b91c1c' },
  liquidated:            { bg: '#fee2e2', text: '#991b1b' },
  refunded:              { bg: '#f3f4f6', text: '#6b7280' },
};

export default function OrdersScreen() {
  const router  = useRouter();
  const session = useAuthStore((s) => s.session);
  const [orders,  setOrders]  = useState<ImportRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    const { data } = await supabase
      .from('import_requests')
      .select('*, contractor:profiles!contractor_id(id, full_name)')
      .eq('buyer_id', session.user.id)
      .order('created_at', { ascending: false });
    setOrders((data ?? []) as ImportRequest[]);
    setLoading(false);
  }, [session]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!session) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header onBack={() => router.back()} />
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Sign in to view your orders</Text>
          <TouchableOpacity style={styles.greenBtn} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.greenBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header onBack={() => router.back()} />

      {loading ? (
        <ActivityIndicator color="#15803d" style={{ marginTop: 40 }} />
      ) : orders.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="bag-outline" size={48} color="#d1d5db" />
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptySubtitle}>
            Find a product abroad and place your first import order.
          </Text>
          <TouchableOpacity style={styles.greenBtn} onPress={() => router.push('/abroad/search')}>
            <Text style={styles.greenBtnText}>Shop from Abroad ✈️</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: order }) => {
            const sc = STATUS_STYLE[order.status];
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => router.push(`/orders/${order.id}`)}
              >
                <View style={styles.cardRow}>
                  {order.product_image ? (
                    <Image
                      source={{ uri: order.product_image }}
                      style={styles.thumb}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={[styles.thumb, styles.thumbPlaceholder]}>
                      <Ionicons name="cube-outline" size={22} color="#9ca3af" />
                    </View>
                  )}
                  <View style={styles.cardBody}>
                    <View style={styles.cardTop}>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {order.product_title}
                      </Text>
                      <View style={[styles.badge, { backgroundColor: sc.bg }]}>
                        <Text style={[styles.badgeText, { color: sc.text }]}>
                          {STATUS_LABELS[order.status]}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.cardMeta}>
                      via {order.contractor?.full_name ?? 'contractor'} · {order.product_platform}
                    </Text>
                    <View style={styles.cardBottom}>
                      <Text style={styles.price}>{formatPrice(order.upfront_dzd)} upfront</Text>
                      <Text style={styles.date}>
                        {new Date(order.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#9ca3af" style={{ marginTop: 2 }} />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={22} color="#111827" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Import Orders</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  backBtn:     { padding: 4, marginRight: 10 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: {
    fontSize: 16, fontWeight: '700', color: '#374151',
    marginTop: 14, marginBottom: 6, textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13, color: '#9ca3af', textAlign: 'center',
    lineHeight: 18, marginBottom: 20,
  },
  greenBtn: {
    backgroundColor: '#15803d', borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  greenBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  card: {
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#e5e7eb', padding: 12,
  },
  cardRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  thumb:    { width: 54, height: 54, borderRadius: 10, backgroundColor: '#f3f4f6' },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1 },
  cardTop:  { flexDirection: 'row', gap: 6, marginBottom: 3 },
  cardTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: '#111827', lineHeight: 18 },
  badge:    { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start', flexShrink: 0 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  cardMeta:  { fontSize: 11, color: '#9ca3af', marginBottom: 6 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  price:    { fontSize: 13, fontWeight: '800', color: '#15803d' },
  date:     { fontSize: 11, color: '#9ca3af' },
});
