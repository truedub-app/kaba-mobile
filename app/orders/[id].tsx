import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Image, Linking,
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

const STEP_LABELS: Partial<Record<ImportRequestStatus, { ar: string; en: string; desc: string }>> = {
  awaiting_verification: { ar: 'طلب مؤكد',     en: 'Order Confirmed', desc: 'Deposit receipt under review' },
  deposit_held:          { ar: 'تم قبول الطلب', en: 'Request Accepted', desc: 'Traveler is purchasing your item' },
  in_transit:            { ar: 'في الطريق',     en: 'In Transit',       desc: 'Traveler is on the way to Algeria' },
  released_to_seller:    { ar: 'تم التسليم',    en: 'Delivered',        desc: 'Order complete. Thank you!' },
};

const LOCAL_STEP_LABELS: Partial<Record<ImportRequestStatus, { ar: string; en: string; desc: string }>> = {
  awaiting_verification: { ar: 'طلب مؤكد',     en: 'Order Confirmed', desc: 'Confirming your deposit payment' },
  deposit_held:          { ar: 'تم قبول الطلب', en: 'Order Accepted',  desc: 'Seller is preparing to ship your item' },
  in_transit:            { ar: 'في الطريق',     en: 'Shipped',         desc: 'Your item is on the way' },
  released_to_seller:    { ar: 'تم التسليم',    en: 'Delivered',        desc: 'Order complete. Thank you!' },
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
      .select('*, contractor:profiles!contractor_id(id, full_name, avatar_url, whatsapp_number)')
      .eq('id', id)
      .single();
    setOrder(data as ImportRequest | null);
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const confirmDelivery = async () => {
    if (!order) return;
    Alert.alert(
      'تأكيد الاستلام | Confirm Delivery',
      'Confirm you have received the item and are satisfied? This releases the held escrow deposit to the seller.',
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
        <Header onBack={() => router.back()} orderId="" />
        <ActivityIndicator color="#15803d" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  const currentIdx = TIMELINE_STEPS.indexOf(order.status);
  const isTerminal = TERMINAL.includes(order.status);
  const isBuyer    = session?.user?.id === order.buyer_id;
  const showActions = isBuyer && order.status === 'in_transit' && !order.buyer_confirmed_at;
  const contractor  = order.contractor as any;
  const whatsapp    = contractor?.whatsapp_number as string | undefined;
  const isLocal     = order.order_type === 'local';
  const isFull      = order.cod_dzd === 0;
  const STEP        = isLocal ? LOCAL_STEP_LABELS : STEP_LABELS;
  const partyEn     = isLocal ? 'Seller' : 'Traveler';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header onBack={() => router.back()} orderId={`#KB-${order.id.slice(0, 4).toUpperCase()}`} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Product + traveler */}
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
              <View style={styles.travelerRow}>
                <View style={styles.travelerAvatar}>
                  <Text style={styles.travelerInitial}>
                    {contractor?.full_name?.[0]?.toUpperCase() ?? 'T'}
                  </Text>
                </View>
                <Text style={styles.travelerLabel}>
                  {partyEn}: <Text style={styles.travelerName}>{contractor?.full_name ?? partyEn}</Text>
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Status timeline */}
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
          <View style={styles.timeline}>
            {TIMELINE_STEPS.map((step, idx) => {
              const done   = idx < currentIdx;
              const active = idx === currentIdx;
              const info   = STEP[step]!;
              const isTransitActive = active && step === 'in_transit';

              return (
                <View key={step} style={styles.timelineRow}>
                  {/* Connector */}
                  {idx < TIMELINE_STEPS.length - 1 && (
                    <View style={[styles.timelineLine, done && styles.timelineLineDone]} />
                  )}
                  {/* Node */}
                  <View style={[
                    styles.node,
                    (done || active) && styles.nodeDone,
                    isTransitActive && styles.nodeTransit,
                  ]}>
                    {isTransitActive ? (
                      <Ionicons name={isLocal ? 'cube' : 'airplane'} size={15} color="#fff" />
                    ) : done || active ? (
                      <Ionicons name="checkmark" size={15} color="#fff" />
                    ) : null}
                  </View>
                  {/* Content */}
                  <View style={[styles.stepContent, isTransitActive && styles.stepContentTransit]}>
                    <Text style={[
                      styles.stepTitle,
                      (done || active) ? { color: '#111827' } : { color: '#9ca3af' },
                    ]}>
                      {info.ar} | {info.en}
                    </Text>
                    {(active || done) && (
                      <Text style={styles.stepDesc}>{info.desc}</Text>
                    )}
                    {isTransitActive && (
                      <Text style={styles.stepEta}>
                        {isLocal ? '📦' : '✈️'} Confirm once the item is in your hands
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Remaining payment banner (hidden when fully prepaid) */}
        {!isTerminal && order.status !== 'released_to_seller' && order.cod_dzd > 0 && (
          <View style={styles.codBanner}>
            <Text style={{ fontSize: 18 }}>💰</Text>
            <Text style={styles.codBannerText}>
              Remaining: <Text style={styles.codAmount}>{formatPrice(order.cod_dzd)}</Text> (pay on delivery)
            </Text>
          </View>
        )}
        {!isTerminal && order.status !== 'released_to_seller' && isFull && (
          <View style={styles.codBanner}>
            <Text style={{ fontSize: 18 }}>✅</Text>
            <Text style={styles.codBannerText}>Fully prepaid — nothing due on delivery</Text>
          </View>
        )}

        {/* Shipment tracking (local orders, once shipped) */}
        {isLocal && (order.courier || order.tracking_number) ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>الشحن | Shipment</Text>
            {order.courier ? <Row label="Courier" value={order.courier} /> : null}
            {order.tracking_number ? <Row label="Tracking number" value={order.tracking_number} /> : null}
            <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, lineHeight: 16 }}>
              Track your parcel on the courier's website, then confirm receipt to release the
              seller's deposit.
            </Text>
          </View>
        ) : null}

        {/* Contact seller / traveler */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {isLocal ? 'تواصل مع البائع | Contact Seller' : 'تواصل مع المسافر | Contact Traveler'}
          </Text>
          <View style={styles.contactRow}>
            <TouchableOpacity
              style={styles.contactBtn}
              activeOpacity={0.8}
              onPress={() => {
                if (whatsapp) Linking.openURL(`https://wa.me/${whatsapp.replace(/[^\d]/g, '')}`);
                else Alert.alert('Unavailable', 'This traveler has no WhatsApp number yet.');
              }}
            >
              <Ionicons name="chatbox-ellipses-outline" size={18} color="#166534" />
              <Text style={styles.contactBtnText}>رسالة | Message</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.contactBtn}
              activeOpacity={0.8}
              onPress={() => {
                if (whatsapp) Linking.openURL(`tel:${whatsapp}`);
                else Alert.alert('Unavailable', 'This traveler has no phone number yet.');
              }}
            >
              <Ionicons name="call-outline" size={18} color="#166534" />
              <Text style={styles.contactBtnText}>اتصال | Call</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Payment summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ملخص الدفع | Payment Summary</Text>
          <Row label={isLocal ? 'Item Price' : 'Total'} value={formatPrice(order.contractor_total_dzd)} />
          <Row label="Security Deposit (20%)" value={formatPrice(order.deposit_dzd)} />
          <Row label={isLocal ? 'KABA Fee (5%)' : 'Platform Fee (5%)'} value={formatPrice(order.buyer_fee_dzd)} />
          <View style={styles.divider} />
          <Row
            label={isFull ? 'Paid in Full' : 'Paid Upfront (25%)'}
            value={formatPrice(order.upfront_dzd)}
            bold
            accent
          />
          {isFull
            ? <Row label="On Delivery" value="—" />
            : <Row label={isLocal ? 'Cash on Delivery (75%)' : 'Cash on Delivery (80%)'} value={formatPrice(order.cod_dzd)} />}
        </View>

        {/* Receipt */}
        {order.receipt_url ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>إيصال الدفع | Payment Receipt</Text>
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
                  <Text style={styles.confirmBtnText}>تأكيد الاستلام | Confirm Delivery</Text>
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
                You confirmed delivery — waiting for {partyEn.toLowerCase()} to confirm.
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 90 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ onBack, orderId }: { onBack: () => void; orderId: string }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={8}>
        <Ionicons name="arrow-back" size={22} color="#111827" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>تتبع الطلب | Track Order {orderId}</Text>
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
  safe:   { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  backBtn:     { padding: 4, marginRight: 10 },
  headerTitle: { fontSize: 16.5, fontWeight: '800', color: '#111827' },
  scroll:      { padding: 16 },

  card: {
    backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1, borderColor: '#f3f4f6',
    padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 1,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#111827', marginBottom: 10 },

  productRow:      { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  productImg:      { width: 76, height: 76, borderRadius: 12, backgroundColor: '#f9fafb' },
  imgPlaceholder:  { alignItems: 'center', justifyContent: 'center' },
  productTitle:    { fontSize: 14.5, fontWeight: '700', color: '#111827', lineHeight: 20 },
  travelerRow:     { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 },
  travelerAvatar:  {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#dcfce7',
    alignItems: 'center', justifyContent: 'center',
  },
  travelerInitial: { fontSize: 12, fontWeight: '800', color: '#15803d' },
  travelerLabel:   { fontSize: 12.5, color: '#6b7280' },
  travelerName:    { color: '#15803d', fontWeight: '800' },

  terminalGray: { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' },
  terminalRed:  { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  terminalTitle: { fontSize: 14, fontWeight: '700' },
  terminalNote:  { fontSize: 12, color: '#6b7280', marginTop: 6 },

  /* Timeline */
  timeline: { marginBottom: 12, paddingTop: 4 },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', position: 'relative', paddingLeft: 44, paddingBottom: 18, minHeight: 58 },
  timelineLine: {
    position: 'absolute', left: 15, top: 32, bottom: -4,
    width: 2.5, backgroundColor: '#e5e7eb', borderRadius: 2,
  },
  timelineLineDone: { backgroundColor: '#15803d' },
  node: {
    position: 'absolute', left: 0, top: 0,
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 2, borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  nodeDone:    { backgroundColor: '#15803d', borderColor: '#15803d' },
  nodeTransit: { backgroundColor: '#15803d', borderColor: '#15803d' },
  stepContent: { flex: 1, paddingTop: 2 },
  stepContentTransit: {
    backgroundColor: '#f0fdf4', borderRadius: 14, padding: 12, marginTop: -6,
    borderWidth: 1, borderColor: '#dcfce7',
  },
  stepTitle: { fontSize: 14.5, fontWeight: '800' },
  stepDesc:  { fontSize: 12, color: '#6b7280', marginTop: 3, lineHeight: 16 },
  stepEta:   { fontSize: 12.5, color: '#15803d', fontWeight: '800', marginTop: 6 },

  /* COD banner */
  codBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    backgroundColor: '#f0fdf4', borderRadius: 14,
    borderWidth: 1, borderColor: '#dcfce7',
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12,
  },
  codBannerText: { fontSize: 13.5, color: '#374151', flex: 1 },
  codAmount: { fontWeight: '900', color: '#166534' },

  /* Contact */
  contactRow: { flexDirection: 'row', gap: 10 },
  contactBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, paddingVertical: 12,
    backgroundColor: '#fff',
  },
  contactBtnText: { fontSize: 13.5, fontWeight: '700', color: '#166534' },

  /* Payment rows */
  row:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  rowLabel: { fontSize: 13, color: '#6b7280' },
  rowValue: { fontSize: 13, fontWeight: '700', color: '#111827' },
  divider:  { height: 1, backgroundColor: '#f3f4f6', marginVertical: 8 },

  receiptImg: { width: '100%', height: 200, borderRadius: 10, marginTop: 4 },

  /* Actions */
  actionsBox: { marginBottom: 12 },
  confirmBtn: {
    backgroundColor: '#166534', borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    marginBottom: 10,
    shadowColor: '#166534', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 9, elevation: 4,
  },
  confirmBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  disputeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8,
  },
  disputeBtnText: { fontSize: 13, color: '#b91c1c', fontWeight: '600' },
});
