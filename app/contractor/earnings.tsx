import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '@/src/lib/supabase';
import { useAuthStore } from '@/src/hooks/useAuth';
import { formatPrice } from '@/src/lib/utils';

interface WalletRow {
  balance_dzd: number;
  total_earned_dzd: number;
}
interface TxRow {
  id: string;
  amount_dzd: number;
  type: string;
  note: string | null;
  created_at: string;
}
interface OrderRow {
  id: string;
  product_title: string;
  deposit_dzd: number;
  seller_fee_dzd: number;
  updated_at: string;
  buyer: { full_name: string | null } | null;
}

export default function ContractorEarningsScreen() {
  const router   = useRouter();
  const session  = useAuthStore((s) => s.session);
  const profile  = useAuthStore((s) => s.profile);

  const [wallet,    setWallet]   = useState<WalletRow | null>(null);
  const [txs,       setTxs]      = useState<TxRow[]>([]);
  const [orders,    setOrders]   = useState<OrderRow[]>([]);
  const [loading,   setLoading]  = useState(true);

  // Commission rate state
  const [rate,     setRate]    = useState<string>(String(profile?.commission_rate ?? 15));
  const [savingRate, setSavingRate] = useState(false);

  const load = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    const uid = session.user.id;
    const [{ data: w }, { data: t }, { data: o }] = await Promise.all([
      supabase.from('contractor_wallet').select('balance_dzd, total_earned_dzd').eq('contractor_id', uid).single(),
      supabase.from('wallet_transactions').select('id, amount_dzd, type, note, created_at').eq('contractor_id', uid).order('created_at', { ascending: false }).limit(20),
      supabase.from('import_requests').select('id, product_title, deposit_dzd, seller_fee_dzd, updated_at, buyer:profiles!buyer_id(full_name)').eq('contractor_id', uid).eq('status', 'released_to_seller').order('updated_at', { ascending: false }).limit(20),
    ]);
    setWallet(w as WalletRow | null);
    setTxs((t ?? []) as TxRow[]);
    setOrders((o ?? []) as OrderRow[]);
    setLoading(false);
  }, [session]);

  useFocusEffect(useCallback(() => {
    load();
    setRate(String(profile?.commission_rate ?? 15));
  }, [load, profile?.commission_rate]));

  const saveRate = async () => {
    const val = parseFloat(rate);
    if (isNaN(val) || val < 0 || val > 50) {
      Alert.alert('Invalid', 'Commission must be between 0% and 50%.');
      return;
    }
    setSavingRate(true);
    const { error } = await supabase
      .from('profiles')
      .update({ commission_rate: val })
      .eq('id', session!.user.id);
    setSavingRate(false);
    if (error) Alert.alert('Error', error.message);
    else Alert.alert('Saved', `Commission rate set to ${val}%.`);
  };

  const balance     = wallet?.balance_dzd      ?? 0;
  const totalEarned = wallet?.total_earned_dzd ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Earnings</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#15803d" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Balance cards */}
          <View style={styles.balanceRow}>
            <View style={[styles.balanceCard, { flex: 1 }]}>
              <Text style={styles.balanceLabel}>Available Balance</Text>
              <Text style={[styles.balanceAmount, { color: '#15803d' }]}>{formatPrice(balance)}</Text>
              <Text style={styles.balanceNote}>Payable on request</Text>
            </View>
            <View style={[styles.balanceCard, { flex: 1 }]}>
              <Text style={styles.balanceLabel}>Total Earned</Text>
              <Text style={styles.balanceAmount}>{formatPrice(totalEarned)}</Text>
              <Text style={styles.balanceNote}>{orders.length} completed orders</Text>
            </View>
          </View>

          {/* Commission rate */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Commission Rate</Text>
            <Text style={styles.cardSubtitle}>
              Added on top of product price when buyers see your quote.
            </Text>
            <View style={styles.rateRow}>
              <View style={styles.rateInputWrap}>
                <TextInput
                  style={styles.rateInput}
                  value={rate}
                  onChangeText={setRate}
                  keyboardType="decimal-pad"
                  maxLength={4}
                />
                <Text style={styles.rateSuffix}>%</Text>
              </View>
              <TouchableOpacity
                style={[styles.saveBtn, savingRate && { opacity: 0.6 }]}
                onPress={saveRate}
                disabled={savingRate}
                activeOpacity={0.85}
              >
                {savingRate ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
              <Text style={styles.rateMultiplier}>
                Multiplier: ×{(1 + (parseFloat(rate) || 0) / 100).toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Completed orders */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Completed Orders</Text>
            {orders.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="cube-outline" size={36} color="#d1d5db" />
                <Text style={styles.emptyText}>No completed orders yet</Text>
              </View>
            ) : (
              orders.map((order) => (
                <View key={order.id} style={styles.orderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderTitle} numberOfLines={1}>{order.product_title}</Text>
                    <Text style={styles.orderMeta}>
                      {order.buyer?.full_name ?? 'Unknown'} ·{' '}
                      {new Date(order.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                  <Text style={styles.orderEarning}>
                    +{formatPrice(order.deposit_dzd - order.seller_fee_dzd)}
                  </Text>
                </View>
              ))
            )}
          </View>

          {/* Transactions */}
          {txs.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Transaction Log</Text>
              {txs.map((tx) => (
                <View key={tx.id} style={styles.txRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txNote}>{tx.note ?? tx.type}</Text>
                    <Text style={styles.txDate}>
                      {new Date(tx.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                  <Text style={[styles.txAmount, tx.type === 'credit' ? { color: '#15803d' } : { color: '#b91c1c' }]}>
                    {tx.type === 'credit' ? '+' : '−'}{formatPrice(tx.amount_dzd)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  backBtn: { padding: 4, marginRight: 10 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  scroll: { padding: 16 },

  balanceRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  balanceCard: {
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#e5e7eb', padding: 14,
  },
  balanceLabel:  { fontSize: 10, fontWeight: '700', color: '#9ca3af', letterSpacing: 0.6, marginBottom: 6 },
  balanceAmount: { fontSize: 22, fontWeight: '900', color: '#111827' },
  balanceNote:   { fontSize: 10, color: '#9ca3af', marginTop: 4 },

  card: {
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#e5e7eb',
    padding: 14, marginBottom: 12,
  },
  cardTitle:    { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 4 },
  cardSubtitle: { fontSize: 12, color: '#9ca3af', marginBottom: 10 },

  rateRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  rateInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 7, gap: 2,
  },
  rateInput:    { fontSize: 16, fontWeight: '700', color: '#111827', minWidth: 36 },
  rateSuffix:   { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  saveBtn: {
    backgroundColor: '#15803d', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  saveBtnText:     { color: '#fff', fontWeight: '700', fontSize: 13 },
  rateMultiplier:  { fontSize: 11, color: '#9ca3af' },

  empty:     { alignItems: 'center', paddingVertical: 20, gap: 6 },
  emptyText: { fontSize: 13, color: '#9ca3af' },

  orderRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6',
  },
  orderTitle:   { fontSize: 13, fontWeight: '600', color: '#111827' },
  orderMeta:    { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  orderEarning: { fontSize: 13, fontWeight: '800', color: '#15803d', flexShrink: 0 },

  txRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6',
  },
  txNote:   { fontSize: 12, color: '#374151' },
  txDate:   { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  txAmount: { fontSize: 13, fontWeight: '700', flexShrink: 0 },
});
