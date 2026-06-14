import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Image, Linking, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '@/src/lib/supabase';
import { useAuthStore } from '@/src/hooks/useAuth';
import { getOrCreateConversation } from '@/src/hooks/useMessages';
import { formatPrice, getAvatarUrl } from '@/src/lib/utils';
import type { ImportRequest } from '@/src/types';

export default function OrderRequestsScreen() {
  const router  = useRouter();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const [orders,    setOrders]    = useState<ImportRequest[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  // Per-order courier + tracking inputs for local sales being shipped
  const [shipForm,  setShipForm]  = useState<Record<string, { courier: string; tracking: string }>>({});

  const load = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    const { data } = await supabase
      .from('import_requests')
      .select('*, buyer:profiles!buyer_id(id, full_name, avatar_url, whatsapp_number)')
      .eq('contractor_id', session.user.id)
      .in('status', ['deposit_held', 'in_transit', 'released_to_seller'])
      .order('created_at', { ascending: false });
    setOrders((data ?? []) as ImportRequest[]);
    setLoading(false);
  }, [session]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Accept = commit to buy & deliver → in_transit
  const accept = (order: ImportRequest) => {
    Alert.alert(
      'Accept Request | قبول الطلب',
      'You commit to purchasing this item and delivering it to the buyer in Algeria.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            setActioning(order.id + '_accept');
            const { error } = await supabase
              .from('import_requests')
              .update({ status: 'in_transit' })
              .eq('id', order.id);
            setActioning(null);
            if (error) Alert.alert('Error', error.message);
            else load();
          },
        },
      ]
    );
  };

  // Local sale: seller ships the item they already own → in_transit + tracking
  const markShippedLocal = async (order: ImportRequest) => {
    const form = shipForm[order.id] ?? { courier: '', tracking: '' };
    if (!form.courier.trim()) {
      Alert.alert('Missing', "Enter the courier you're shipping with.");
      return;
    }
    setActioning(order.id + '_accept');
    const { error } = await supabase
      .from('import_requests')
      .update({
        status: 'in_transit',
        courier: form.courier.trim(),
        tracking_number: form.tracking.trim() || null,
      })
      .eq('id', order.id);
    setActioning(null);
    if (error) Alert.alert('Error', error.message);
    else load();
  };

  // Decline = flag for admin to refund the buyer's deposit
  const decline = (order: ImportRequest) => {
    Alert.alert(
      'Decline Request | رفض الطلب',
      'The buyer will be refunded their deposit by KABA. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setActioning(order.id + '_decline');
            const { error } = await supabase
              .from('import_requests')
              .update({
                status: 'disputed',
                admin_notes: 'Contractor declined the request — refund the buyer deposit.',
              })
              .eq('id', order.id);
            setActioning(null);
            if (error) Alert.alert('Error', error.message);
            else { Alert.alert('Declined', 'KABA will refund the buyer.'); load(); }
          },
        },
      ]
    );
  };

  const confirmDelivery = (order: ImportRequest) => {
    Alert.alert(
      'Confirm Delivery | تأكيد التسليم',
      order.order_type === 'local'
        ? 'Confirm the buyer has received the item?'
        : 'Confirm you have personally handed the item to the buyer?',
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
        <Header onBack={() => router.back()} onEarnings={() => router.push('/contractor/earnings')} />
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Sellers only</Text>
          <Text style={styles.emptySubtitle}>Register as a seller to receive order requests.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const requests  = orders.filter((o) => o.status === 'deposit_held');
  const active    = orders.filter((o) => o.status === 'in_transit');
  const completed = orders.filter((o) => o.status === 'released_to_seller');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header onBack={() => router.back()} onEarnings={() => router.push('/contractor/earnings')} />

      {loading ? (
        <ActivityIndicator color="#15803d" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Title block */}
          <View style={styles.titleBlock}>
            <View style={styles.titleIcon}>
              <Ionicons name="bag-handle-outline" size={26} color="#15803d" />
            </View>
            <View>
              <Text style={styles.title}>طلبات الشراء | Order Requests</Text>
              <Text style={styles.subtitle}>Incoming requests from customers</Text>
            </View>
          </View>

          {orders.length === 0 ? (
            <View style={styles.centered}>
              <Ionicons name="cube-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyTitle}>No requests yet</Text>
              <Text style={styles.emptySubtitle}>
                Buyers will place orders once they find you through your registered trips.
              </Text>
              <TouchableOpacity style={styles.greenBtn} onPress={() => router.push('/trips')}>
                <Text style={styles.greenBtnText}>رحلاتي | My Trips</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* ── New requests ── */}
              {requests.map((order) => (
                <RequestCard key={order.id} order={order}>
                  {order.order_type === 'local' ? (
                    <View>
                      <View style={styles.shipFormRow}>
                        <TextInput
                          style={[styles.shipInput, { flex: 1.2 }]}
                          placeholder="Courier (e.g. Yalidine)"
                          placeholderTextColor="#9ca3af"
                          value={shipForm[order.id]?.courier ?? ''}
                          onChangeText={(t) => setShipForm((s) => ({ ...s, [order.id]: { courier: t, tracking: s[order.id]?.tracking ?? '' } }))}
                        />
                        <TextInput
                          style={[styles.shipInput, { flex: 1 }]}
                          placeholder="Tracking (optional)"
                          placeholderTextColor="#9ca3af"
                          value={shipForm[order.id]?.tracking ?? ''}
                          onChangeText={(t) => setShipForm((s) => ({ ...s, [order.id]: { courier: s[order.id]?.courier ?? '', tracking: t } }))}
                        />
                      </View>
                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          style={[styles.acceptBtn, { flex: 2 }, actioning === order.id + '_accept' && { opacity: 0.6 }]}
                          disabled={!!actioning}
                          onPress={() => markShippedLocal(order)}
                          activeOpacity={0.85}
                        >
                          {actioning === order.id + '_accept'
                            ? <ActivityIndicator color="#fff" size="small" />
                            : <Text style={styles.acceptText}>📦 Mark as Shipped</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.declineBtn, actioning === order.id + '_decline' && { opacity: 0.6 }]}
                          disabled={!!actioning}
                          onPress={() => decline(order)}
                          activeOpacity={0.85}
                        >
                          {actioning === order.id + '_decline'
                            ? <ActivityIndicator color="#6b7280" size="small" />
                            : <Text style={styles.declineText}>Decline</Text>}
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={[styles.acceptBtn, actioning === order.id + '_accept' && { opacity: 0.6 }]}
                        disabled={!!actioning}
                        onPress={() => accept(order)}
                        activeOpacity={0.85}
                      >
                        {actioning === order.id + '_accept'
                          ? <ActivityIndicator color="#fff" size="small" />
                          : <Text style={styles.acceptText}>قبول | Accept</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.declineBtn, actioning === order.id + '_decline' && { opacity: 0.6 }]}
                        disabled={!!actioning}
                        onPress={() => decline(order)}
                        activeOpacity={0.85}
                      >
                        {actioning === order.id + '_decline'
                          ? <ActivityIndicator color="#6b7280" size="small" />
                          : <Text style={styles.declineText}>رفض | Decline</Text>}
                      </TouchableOpacity>
                    </View>
                  )}
                </RequestCard>
              ))}

              {/* ── In transit (Confirm Delivery) ── */}
              {active.length > 0 && (
                <Text style={styles.sectionHeader}>في الطريق | IN TRANSIT ({active.length})</Text>
              )}
              {active.map((order) => (
                <RequestCard key={order.id} order={order}>
                  {!order.contractor_confirmed_at ? (
                    <TouchableOpacity
                      style={[styles.acceptBtn, { alignSelf: 'stretch' }, actioning === order.id + '_confirm' && { opacity: 0.6 }]}
                      disabled={!!actioning}
                      onPress={() => confirmDelivery(order)}
                      activeOpacity={0.85}
                    >
                      {actioning === order.id + '_confirm'
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={styles.acceptText}>تأكيد التسليم | Confirm Delivery</Text>}
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.confirmedRow}>
                      <Ionicons name="checkmark-circle" size={15} color="#15803d" />
                      <Text style={styles.confirmedText}>You confirmed — waiting for buyer</Text>
                    </View>
                  )}
                </RequestCard>
              ))}

              {/* ── Completed ── */}
              {completed.length > 0 && (
                <Text style={styles.sectionHeader}>مكتملة | COMPLETED ({completed.length})</Text>
              )}
              {completed.map((order) => (
                <RequestCard key={order.id} order={order} muted>
                  <View style={styles.confirmedRow}>
                    <Ionicons name="checkmark-done-circle" size={15} color="#15803d" />
                    <Text style={styles.confirmedText}>
                      {order.order_type === 'local'
                        ? `Received ${formatPrice(order.cod_dzd + order.upfront_dzd - order.buyer_fee_dzd - order.seller_fee_dzd)}`
                        : `Earned ${formatPrice(order.deposit_dzd - order.seller_fee_dzd)}`}
                    </Text>
                  </View>
                </RequestCard>
              ))}
            </>
          )}
          <View style={{ height: 90 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function RequestCard({ order, muted, children }: {
  order: ImportRequest; muted?: boolean; children?: React.ReactNode;
}) {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const [messaging, setMessaging] = useState(false);
  const buyer = order.buyer as any;
  const avatarUrl = buyer?.avatar_url ? getAvatarUrl(buyer.avatar_url) : null;
  const waNum = buyer?.whatsapp_number ? String(buyer.whatsapp_number).replace(/\D/g, '') : null;

  const messageBuyer = async () => {
    if (!session?.user || !buyer?.id) return;
    setMessaging(true);
    const id = await getOrCreateConversation(null, session.user.id, buyer.id);
    setMessaging(false);
    if (id) router.push(`/chat/${id}`);
    else Alert.alert('Error', 'Could not open the conversation.');
  };

  const openProduct = () => {
    if (order.order_type === 'local' && order.listing_id) {
      router.push(`/listing/${order.listing_id}`);
    } else if (order.product_url) {
      Linking.openURL(order.product_url);
    }
  };
  const productTappable = (order.order_type === 'local' && !!order.listing_id) || !!order.product_url;

  return (
    <View style={[styles.card, muted && { opacity: 0.72 }]}>
      <View style={styles.cardTop}>
        <View style={styles.buyerRow}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.buyerAvatar} />
          ) : (
            <View style={[styles.buyerAvatar, styles.buyerAvatarFallback]}>
              <Text style={styles.buyerInitial}>{(buyer?.full_name ?? '?').charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.buyerName} numberOfLines={1}>{buyer?.full_name ?? 'Buyer'}</Text>
        </View>
        <View style={styles.paidBadge}>
          <Text style={styles.paidBadgeText}>20% Paid ✓</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.productRow}
        activeOpacity={productTappable ? 0.6 : 1}
        onPress={productTappable ? openProduct : undefined}
        disabled={!productTappable}
      >
        {order.product_image ? (
          <Image source={{ uri: order.product_image }} style={styles.productThumb} resizeMode="contain" />
        ) : (
          <View style={[styles.productThumb, styles.productThumbFallback]}>
            <Ionicons name="cube-outline" size={22} color="#9ca3af" />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.productTitle} numberOfLines={2}>{order.product_title}</Text>
          {productTappable && (
            <Text style={styles.viewProduct}>
              {order.order_type === 'local' ? 'View listing →' : 'View product →'}
            </Text>
          )}
          <View style={styles.locationRow}>
            <Ionicons name="location-sharp" size={13} color="#15803d" />
            <Text style={styles.locationText}>Algeria</Text>
          </View>
        </View>
        <Text style={styles.productPrice}>
          {(order.product_price_original ?? 0).toLocaleString('fr-FR', {
            style: 'currency',
            currency: order.product_currency || 'EUR',
            maximumFractionDigits: 0,
          })}
        </Text>
      </TouchableOpacity>

      {/* Ship-to address (local orders) */}
      {order.shipping_address ? (
        <View style={styles.shipTo}>
          <Ionicons name="location-outline" size={15} color="#15803d" />
          <View style={{ flex: 1 }}>
            <Text style={styles.shipToLabel}>Ship to</Text>
            <Text style={styles.shipToText}>{order.shipping_address}</Text>
            {order.shipping_phone ? (
              <Text style={styles.shipToPhone}>📞 {order.shipping_phone}</Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {children}

      {/* Contact buyer — full-size Message + WhatsApp */}
      {buyer?.id && (
        <View style={styles.contactBuyerRow}>
          <TouchableOpacity
            style={[styles.contactBuyerBtn, styles.contactMsgBtn]}
            onPress={messageBuyer}
            disabled={messaging}
            activeOpacity={0.85}
          >
            {messaging ? (
              <ActivityIndicator size="small" color="#166534" />
            ) : (
              <>
                <Ionicons name="chatbubble-ellipses-outline" size={17} color="#166534" />
                <Text style={styles.contactBuyerText}>Message</Text>
              </>
            )}
          </TouchableOpacity>
          {waNum && (
            <TouchableOpacity
              style={[styles.contactBuyerBtn, styles.contactWaBtn]}
              onPress={() => {
                const text = encodeURIComponent(`Hi ${buyer.full_name ?? ''}, regarding your KABA order: "${order.product_title}".`);
                Linking.openURL(`https://wa.me/${waNum}?text=${text}`);
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="logo-whatsapp" size={17} color="#16a34a" />
              <Text style={styles.contactBuyerText}>WhatsApp</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

function Header({ onBack, onEarnings }: { onBack: () => void; onEarnings: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={8}>
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.headerLogo}>KABA</Text>
      <TouchableOpacity onPress={onEarnings} style={styles.earningsBtn} hitSlop={8}>
        <Ionicons name="wallet-outline" size={20} color="#bbf7d0" />
        <Text style={styles.earningsBtnText}>Earnings</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#14532d',
  },
  backBtn: { padding: 4, marginRight: 10 },
  headerLogo: { flex: 1, fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: 1.5 },
  earningsBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  earningsBtnText: { fontSize: 13, fontWeight: '700', color: '#bbf7d0' },

  scroll: { padding: 16 },

  titleBlock: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  titleIcon: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#dcfce7',
  },
  title: { fontSize: 19, fontWeight: '900', color: '#111827' },
  subtitle: { fontSize: 12.5, color: '#6b7280', marginTop: 2 },

  centered: { alignItems: 'center', paddingVertical: 50, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginTop: 14, marginBottom: 6, textAlign: 'center' },
  emptySubtitle: { fontSize: 13, color: '#9ca3af', textAlign: 'center', lineHeight: 18, marginBottom: 20 },
  greenBtn: { backgroundColor: '#15803d', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  greenBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  sectionHeader: {
    fontSize: 11, fontWeight: '800', color: '#9ca3af',
    letterSpacing: 0.8, marginTop: 10, marginBottom: 10,
  },

  card: {
    backgroundColor: '#fff', borderRadius: 18,
    borderWidth: 1, borderColor: '#f3f4f6', padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  buyerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  buyerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f3f4f6' },
  buyerAvatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#dcfce7' },
  buyerInitial: { fontSize: 18, fontWeight: '800', color: '#15803d' },
  buyerName: { fontSize: 15.5, fontWeight: '800', color: '#111827', flexShrink: 1 },
  contactBuyerRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  contactBuyerBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, borderRadius: 12, paddingVertical: 12, borderWidth: 1.5,
  },
  contactMsgBtn: { borderColor: '#166534', backgroundColor: '#f0fdf4' },
  contactWaBtn: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  contactBuyerText: { fontSize: 14, fontWeight: '700', color: '#166534' },
  paidBadge: {
    backgroundColor: '#dcfce7', borderRadius: 999,
    paddingHorizontal: 11, paddingVertical: 5,
  },
  paidBadgeText: { fontSize: 12, fontWeight: '800', color: '#15803d' },

  productRow: { flexDirection: 'row', gap: 11, alignItems: 'flex-start', marginBottom: 12 },
  productThumb: { width: 64, height: 64, borderRadius: 12, backgroundColor: '#f9fafb' },
  productThumbFallback: { alignItems: 'center', justifyContent: 'center' },
  productTitle: { fontSize: 14, fontWeight: '700', color: '#111827', lineHeight: 19 },
  productMeta: { fontSize: 12, color: '#9ca3af', marginTop: 3 },
  viewProduct: { fontSize: 12, color: '#15803d', fontWeight: '700', marginTop: 3 },
  shipTo: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#f0fdf4', borderRadius: 12, padding: 10, marginBottom: 12,
  },
  shipToLabel: { fontSize: 11, fontWeight: '800', color: '#166534', marginBottom: 2 },
  shipToText: { fontSize: 13, color: '#374151', lineHeight: 18 },
  shipToPhone: { fontSize: 12.5, color: '#15803d', fontWeight: '700', marginTop: 3 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  locationText: { fontSize: 12, color: '#374151' },
  productPrice: { fontSize: 17, fontWeight: '900', color: '#166534' },

  shipFormRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  shipInput: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, color: '#111827',
    backgroundColor: '#fff',
  },
  actionRow: { flexDirection: 'row', gap: 10 },
  acceptBtn: {
    flex: 1, backgroundColor: '#166534', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
  },
  acceptText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  declineBtn: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#d1d5db',
  },
  declineText: { color: '#374151', fontWeight: '700', fontSize: 14 },

  confirmedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  confirmedText: { fontSize: 13, color: '#15803d', fontWeight: '700' },
});
