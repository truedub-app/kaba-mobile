import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, Alert, Image,
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

export default function ContractorOrdersScreen() {
  const router  = useRouter();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const [orders,   setOrders]   = useState<ImportRequest[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    const { data } = await supabase
      .from('import_requests')
      .select('*, buyer:profiles!buyer_id(id, full_name, whatsapp_number)')
      .eq('contractor_id', session.user.id)
      .in('status', ['deposit_held', 'in_transit', 'released_to_seller'])
      .order('created_at', { ascending: false });
    setOrders((data ?? []) as ImportRequest[]);
    setLoading(false);
  }, [session]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const markShipped = async (order: ImportRequest) => {
    setActioning(order.id + '_ship');
    const { error } = await supabase
      .from('import_requests')
      .update({ status: 'in_transit' })
      .eq('id', order.id);
    setActioning(null);
    if (error) Alert.alert('Error', error.message);
    else { Alert.alert('Marked as Shipped', 'The buyer has been notified.'); load(); }
  };

  const confirmDelivery = (order: ImportRequest) => {
    Alert.alert(
      'Confirm Delivery',
      'Confirm you have personally handed the item to the buyer?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setActioning(order.id + '_confirm');
            const { error } = await supabase
              .from('import_requests')
              .update({ contractor_confirmed_at: new Date().toISOString() })
              .eq('id', order.id);
            setActioning(null);
            if (error) Alert.alert('Error', error.message);
            else { Alert.alert('Confirmed!', 'Waiting for buyer to confirm as well.'); load(); }
          },
        },
      ]
    );
  };

  if (!session || (profile?.role !== 'seller' && profile?.role !== 'admin')) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header onBack={() => router.back()} />
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Sellers only</Text>
          <Text style={styles.emptySubtitle}>Register as a seller to manage deliveries.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const active    = orders.filter((o) => ['deposit_held', 'in_transit'].includes(o.status));
  const completed = orders.filter((o) => o.status === 'released_to_seller');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header onBack={() => router.back()} />

      {loading ? (
        <ActivityIndicator color="#15803d" style={{ marginTop: 40 }} />
      ) : orders.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="cube-outline" size={48} color="#d1d5db" />
          <Text style={styles.emptyTitle}>No pending deliveries</Text>
          <Text style={styles.emptySubtitle}>
            Buyers will place orders once they find you through your registered trips.
          </Text>
          <TouchableOpacity style={styles.greenBtn} onPress={() => router.push('/trips')}>
            <Text style={styles.greenBtnText}>Manage My Trips</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={[...active, ...completed]}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            active.length > 0 ? (
              <Text style={styles.sectionHeader}>ACTIVE ({active.length})</Text>
            ) : null
          }
          renderItem={({ item: order }) => {
            const isCompleted = order.status === 'released_to_seller';
            const sc = STATUS_STYLE[order.status];
            const isShipping  = actioning === order.id + '_ship';
            const isConfirming = actioning === order.id + '_confirm';

            return (
              <View style={[styles.card, isCompleted && { opacity: 0.7 }]}>
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
                      <Text style={styles.cardTitle} numberOfLines={2}>{order.product_title}</Text>
                      <View style={[styles.badge, { backgroundColor: sc.bg }]}>
                        <Text style={[styles.badgeText, { color: sc.text }]}>
                          {STATUS_LABELS[order.status]}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.cardMeta}>
                      Buyer: {order.buyer?.full_name ?? 'Unknown'}
                    </Text>
                    <Text style={styles.earnings}>
                      {isCompleted ? 'Earned ' : 'You earn '}{formatPrice(order.deposit_dzd - order.seller_fee_dzd)}
                    </Text>
                  </View>
                </View>

                {/* Action row */}
                {!isCompleted && (
                  <View style={styles.actionRow}>
                    {order.status === 'deposit_held' && (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnGreen, isShipping && { opacity: 0.6 }]}
                        disabled={isShipping}
                        onPress={() => markShipped(order)}
                        activeOpacity={0.85}
                      >
                        {isShipping ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <>
                            <Ionicons name="send-outline" size={14} color="#fff" />
                            <Text style={styles.actionBtnText}>Mark as Shipped</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}

                    {order.status === 'in_transit' && !order.contractor_confirmed_at && (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnEmerald, isConfirming && { opacity: 0.6 }]}
                        disabled={isConfirming}
                        onPress={() => confirmDelivery(order)}
                        activeOpacity={0.85}
                      >
                        {isConfirming ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <>
                            <Ionicons name="checkmark-circle-outline" size={14} color="#fff" />
                            <Text style={styles.actionBtnText}>Confirm Delivery</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}

                    {order.status === 'in_transit' && order.contractor_confirmed_at && (
                      <View style={styles.confirmedRow}>
                        <Ionicons name="checkmark-circle" size={14} color="#15803d" />
                        <Text style={styles.confirmedText}>
                          You confirmed — waiting for buyer
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          }}
          ListFooterComponent={
            completed.length > 0 ? (
              <Text style={[styles.sectionHeader, { marginTop: 8 }]}>
                COMPLETED ({completed.length})
              </Text>
            ) : null
          }
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
      <Text style={styles.headerTitle}>Pending Deliveries</Text>
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

  sectionHeader: {
    fontSize: 11, fontWeight: '700', color: '#9ca3af',
    letterSpacing: 0.8, marginBottom: 8,
  },

  card: {
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#e5e7eb', padding: 12,
  },
  cardRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  thumb:    { width: 52, height: 52, borderRadius: 10, backgroundColor: '#f3f4f6' },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1 },
  cardTop:  { flexDirection: 'row', gap: 6, marginBottom: 2 },
  cardTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: '#111827', lineHeight: 18 },
  badge:    { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start', flexShrink: 0 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  cardMeta:  { fontSize: 11, color: '#9ca3af', marginBottom: 3 },
  earnings:  { fontSize: 12, fontWeight: '700', color: '#15803d' },

  actionRow: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 10 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 9, paddingHorizontal: 14,
    borderRadius: 10, alignSelf: 'flex-start',
  },
  actionBtnGreen:   { backgroundColor: '#15803d' },
  actionBtnEmerald: { backgroundColor: '#059669' },
  actionBtnText:    { color: '#fff', fontWeight: '700', fontSize: 13 },
  confirmedRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  confirmedText: { fontSize: 12, color: '#15803d', fontWeight: '600' },
});
