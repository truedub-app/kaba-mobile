import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '@/src/lib/supabase';
import { useAuthStore } from '@/src/hooks/useAuth';
import { formatPrice } from '@/src/lib/utils';
import { STATUS_LABELS } from '@/src/types';
import type { ImportRequest, ImportRequestStatus } from '@/src/types';

const TIMELINE_STEPS: ImportRequestStatus[] = [
  'awaiting_verification',
  'deposit_held',
  'in_transit',
  'released_to_seller',
];

const STEP_DESC: Partial<Record<ImportRequestStatus, string>> = {
  awaiting_verification: 'Admin is reviewing your BaridiMob receipt',
  deposit_held:          'Contractor has been notified to purchase your item',
  in_transit:            'Item is on its way — confirm once you receive it',
  released_to_seller:    'Order complete. Thank you!',
};

const TERMINAL: ImportRequestStatus[] = ['disputed', 'liquidated', 'refunded'];

export default function OrderDetailScreen() {
  const router  = useRouter();
  const session = useAuthStore((s) => s.session);
  const { id }  = useLocalSearchParams<{ id: string }>();

  const [order,    setOrder]    = useState<ImportRequest | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [actioning, setActioning] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from('import_requests')
      .select('*, contractor:profiles!contractor_id(id, full_name, whatsapp_number)')
      .eq('id', id)
      .single();
    setOrder(data as ImportRequest | null);
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const confirmDelivery = async () => {
    if (!order) return;
    Alert.alert(
      'Confirm Delivery',
      'Confirm you have received the item and are satisfied? This releases the escrow to the contractor.',
      [
        { text: 'Not Yet', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setActioning(true);
            const { error } = await supabase
              .from('import_requests')
              .update({ buyer_confirmed_at: new Date().toISOString() })
              .eq('id', order.id);
            setActioning(false);
            if (error) Alert.alert('Error', error.message);
            else { Alert.alert('Confirmed!', 'Thank you. Your order is complete.'); load(); }
          },
        },
      ]
    );
  };

  const raiseDispute = async () => {
    if (!order) return;
    Alert.alert(
      'Raise Dispute',
      'An admin will review both sides and contact you. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Raise Dispute',
          style: 'destructive',
          onPress: async () => {
            setActioning(true);
            const { error } = await supabase
              .from('import_requests')
              .update({ status: 'disputed' })
              .eq('id', order.id);
            setActioning(false);
            if (error) Alert.alert('Error', error.message);
            else { Alert.alert('Dispute Raised', 'Admin will contact you shortly.'); load(); }
          },
        },
      ]
    );
  };

  if (loading || !order) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header onBack={() => router.back()} />
        <ActivityIndicator color="#15803d" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  const currentIdx = TIMELINE_STEPS.indexOf(order.status);
  const isTerminal = TERMINAL.includes(order.status);
  const isBuyer    = session?.user?.id === order.buyer_id;
  const showActions = isBuyer && order.status === 'in_transit' && !order.buyer_confirmed_at;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Order ID */}
        <Text style={styles.orderId}>
          #{order.id.slice(0, 8).toUpperCase()} ·{' '}
          {new Date(order.created_at).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'long', year: 'numeric',
          })}
        </Text>

        {/* Product */}
        <View style={styles.card}>
          <View style={styles.productRow}>
            {order.product_image ? (
              <Image
                source={{ uri: order.product_image }}
                style={styles.productImg}
                resizeMode="contain"
              />
            ) : (
              <View style={[styles.productImg, styles.imgPlaceholder]}>
                <Ionicons name="cube-outline" size={26} color="#9ca3af" />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.productTitle} numberOfLines={3}>{order.product_title}</Text>
              <Text style={styles.productPlatform}>{order.product_platform}</Text>
            </View>
          </View>
        </View>

        {/* Status */}
        {isTerminal ? (
          <View style={[styles.card, order.status === 'refunded' ? styles.terminalGray : styles.terminalRed]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons
                name={order.status === 'refunded' ? 'refresh-outline' : 'warning-outline'}
                size={18}
                color={order.status === 'refunded' ? '#6b7280' : '#b91c1c'}
              />
              <Text style={[styles.terminalTitle, order.status === 'refunded' ? { color: '#374151' } : { color: '#b91c1c' }]}>
                {STATUS_LABELS[order.status]}
              </Text>
            </View>
            {order.admin_notes ? (
              <Text style={styles.terminalNote}>{order.admin_notes}</Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Order Progress</Text>
            {/* Timeline */}
            <View style={styles.timeline}>
              {TIMELINE_STEPS.map((step, idx) => {
                const done   = idx < currentIdx;
                const active = idx === currentIdx;
                return (
                  <View key={step} style={styles.timelineRow}>
                    {/* Line connector */}
                    {idx > 0 && (
                      <View style={[styles.timelineLine, done && styles.timelineLineDone]} />
                    )}
                    {/* Dot */}
                    <View
                      style={[
                        styles.timelineDot,
                        done   && styles.timelineDotDone,
                        active && styles.timelineDotActive,
                      ]}
                    >
                      {done ? (
                        <Ionicons name="checkmark" size={12} color="#fff" />
                      ) : active ? (
                        <View style={styles.timelineDotInner} />
                      ) : null}
                    </View>
                    {/* Label */}
                    <View style={styles.timelineLabel}>
                      <Text
                        style={[
                          styles.timelineStep,
                          done   && { color: '#374151' },
                          active && { color: '#15803d', fontWeight: '700' },
                          !done && !active && { color: '#9ca3af' },
                        ]}
                      >
                        {STATUS_LABELS[step]}
                      </Text>
                      {active && STEP_DESC[step] ? (
                        <Text style={styles.timelineDesc}>{STEP_DESC[step]}</Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Payment summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment Summary</Text>
          <Row label="Contractor Total"      value={formatPrice(order.contractor_total_dzd)} />
          <Row label="Security Deposit (20%)" value={formatPrice(order.deposit_dzd)} />
          <Row label="Platform Fee (5%)"      value={formatPrice(order.buyer_fee_dzd)} />
          <View style={styles.divider} />
          <Row label="Paid Upfront (25%)"     value={formatPrice(order.upfront_dzd)} bold accent />
          <View style={styles.codBox}>
            <Row label="Cash on Delivery (80%)" value={formatPrice(order.cod_dzd)} />
            <Text style={styles.codNote}>Paid directly to contractor on delivery</Text>
          </View>
        </View>

        {/* Contractor */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Contractor</Text>
          <View style={styles.contractorRow}>
            <View style={styles.contractorAvatar}>
              <Text style={styles.contractorInitial}>
                {order.contractor?.full_name?.[0]?.toUpperCase() ?? 'C'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contractorName}>{order.contractor?.full_name ?? 'Contractor'}</Text>
              {order.contractor?.whatsapp_number ? (
                <Text style={styles.whatsapp}>
                  WhatsApp: {order.contractor.whatsapp_number}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Receipt */}
        {order.receipt_url ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Payment Receipt</Text>
            <Image
              source={{ uri: order.receipt_url }}
              style={styles.receiptImg}
              resizeMode="contain"
            />
          </View>
        ) : null}

        {/* Admin note */}
        {order.admin_notes && !isTerminal ? (
          <View style={[styles.card, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#b45309', marginBottom: 4 }}>
              Note from Admin
            </Text>
            <Text style={{ fontSize: 13, color: '#92400e' }}>{order.admin_notes}</Text>
          </View>
        ) : null}

        {/* Buyer actions */}
        {showActions && (
          <View style={styles.actionsBox}>
            <Text style={styles.actionsTitle}>Item Arrived?</Text>
            <Text style={styles.actionsSubtitle}>
              Confirm delivery once you've received your item. This releases the escrow to the contractor.
            </Text>
            <TouchableOpacity
              style={[styles.confirmBtn, actioning && { opacity: 0.6 }]}
              onPress={confirmDelivery}
              disabled={actioning}
              activeOpacity={0.85}
            >
              {actioning ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={styles.confirmBtnText}>Confirm Delivery</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.disputeBtn, actioning && { opacity: 0.5 }]}
              onPress={raiseDispute}
              disabled={actioning}
              activeOpacity={0.7}
            >
              <Ionicons name="warning-outline" size={16} color="#b91c1c" />
              <Text style={styles.disputeBtnText}>There&apos;s a problem — Raise a Dispute</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Buyer already confirmed */}
        {isBuyer && order.status === 'in_transit' && order.buyer_confirmed_at && (
          <View style={[styles.card, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="checkmark-circle" size={16} color="#15803d" />
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#15803d' }}>
                You confirmed delivery — waiting for contractor to confirm.
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={22} color="#111827" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Order Details</Text>
    </View>
  );
}

function Row({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && { fontWeight: '700', color: '#111827' }]}>{label}</Text>
      <Text style={[styles.rowValue, accent && { color: '#15803d', fontSize: 15 }]}>{value}</Text>
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
  scroll:      { padding: 16 },

  orderId: { fontSize: 12, color: '#9ca3af', marginBottom: 12 },

  card: {
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#e5e7eb',
    padding: 14, marginBottom: 12,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 10 },

  productRow:      { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  productImg:      { width: 72, height: 72, borderRadius: 10, backgroundColor: '#f3f4f6' },
  imgPlaceholder:  { alignItems: 'center', justifyContent: 'center' },
  productTitle:    { fontSize: 13, fontWeight: '600', color: '#111827', lineHeight: 18 },
  productPlatform: { fontSize: 11, color: '#9ca3af', marginTop: 3 },

  terminalGray: { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' },
  terminalRed:  { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  terminalTitle: { fontSize: 14, fontWeight: '700' },
  terminalNote:  { fontSize: 12, color: '#6b7280', marginTop: 6 },

  /* Timeline */
  timeline: { gap: 0 },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', position: 'relative', paddingLeft: 28, paddingBottom: 16 },
  timelineLine: {
    position: 'absolute', left: 11, top: -8, bottom: 8,
    width: 2, backgroundColor: '#e5e7eb',
  },
  timelineLineDone: { backgroundColor: '#15803d' },
  timelineDot: {
    position: 'absolute', left: 4, top: 2,
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: '#d1d5db',
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  timelineDotDone:   { backgroundColor: '#15803d', borderColor: '#15803d' },
  timelineDotActive: { borderColor: '#15803d' },
  timelineDotInner:  { width: 6, height: 6, borderRadius: 3, backgroundColor: '#15803d' },
  timelineLabel: { flex: 1 },
  timelineStep:  { fontSize: 13, fontWeight: '600', color: '#374151' },
  timelineDesc:  { fontSize: 11, color: '#9ca3af', marginTop: 2, lineHeight: 15 },

  /* Payment rows */
  row:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  rowLabel: { fontSize: 13, color: '#6b7280' },
  rowValue: { fontSize: 13, fontWeight: '700', color: '#111827' },
  divider:  { height: 1, backgroundColor: '#e5e7eb', marginVertical: 8 },
  codBox:   { backgroundColor: '#fffbeb', borderRadius: 10, padding: 10, marginTop: 6 },
  codNote:  { fontSize: 10, color: '#a16207', marginTop: 2 },

  /* Contractor */
  contractorRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  contractorAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#dcfce7',
    alignItems: 'center', justifyContent: 'center',
  },
  contractorInitial: { fontSize: 15, fontWeight: '800', color: '#15803d' },
  contractorName:    { fontSize: 14, fontWeight: '600', color: '#111827' },
  whatsapp:          { fontSize: 11, color: '#15803d', marginTop: 2 },

  receiptImg: { width: '100%', height: 200, borderRadius: 10, marginTop: 4 },

  /* Actions */
  actionsBox: {
    backgroundColor: '#f0fdf4', borderRadius: 14, borderWidth: 1,
    borderColor: '#bbf7d0', padding: 14, marginBottom: 12,
  },
  actionsTitle:    { fontSize: 14, fontWeight: '700', color: '#14532d', marginBottom: 4 },
  actionsSubtitle: { fontSize: 12, color: '#166534', lineHeight: 16, marginBottom: 12 },
  confirmBtn: {
    backgroundColor: '#15803d', borderRadius: 12, paddingVertical: 13,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginBottom: 10,
  },
  confirmBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  disputeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8,
  },
  disputeBtnText: { fontSize: 13, color: '#b91c1c', fontWeight: '600' },
});
