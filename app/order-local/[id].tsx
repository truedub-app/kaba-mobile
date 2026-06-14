import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '@/src/lib/supabase';
import { useAuthStore } from '@/src/hooks/useAuth';
import { formatPrice, getListingImageUrl } from '@/src/lib/utils';

const WEB_API = process.env.EXPO_PUBLIC_KABA_API_URL ?? 'https://dz-kaba.com';

type PayMethod = 'chargily' | 'manual';

interface LocalListing {
  id: string;
  title: string;
  price: number;
  images: string[];
  seller_id: string;
  status: string;
}

/** Secure-order checkout for an in-Algeria listing (same escrow split as the
 *  import flow: 20% deposit + 5% KABA fee upfront, 80% cash on delivery). */
export default function OrderLocalScreen() {
  const router  = useRouter();
  const session = useAuthStore((s) => s.session);
  const { id }  = useLocalSearchParams<{ id: string }>();

  const [listing,    setListing]    = useState<LocalListing | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [receipt,    setReceipt]    = useState<string | null>(null); // local URI
  const [payMethod,  setPayMethod]  = useState<PayMethod>('chargily');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('listings')
      .select('id, title, price, images, seller_id, status')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setListing(data as LocalListing | null);
        setLoading(false);
      });
  }, [id]);

  const price      = Number(listing?.price ?? 0);
  const depositDzd = Math.round(price * 0.20);
  const buyerFee   = Math.round(price * 0.05);
  const sellerFee  = Math.round(price * 0.05);
  const upfrontDzd = depositDzd + buyerFee;
  const codDzd     = price - depositDzd;
  const imageUrl   = listing?.images?.length ? getListingImageUrl(listing.images, 0) : null;

  const pickReceipt = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission required'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.9 });
    if (!result.canceled) setReceipt(result.assets[0].uri);
  };

  const createOrder = async (uid: string, receiptUrl: string | null) => {
    if (!listing) throw new Error('Listing not loaded');
    const { data, error } = await supabase
      .from('import_requests')
      .insert({
        buyer_id:               uid,
        contractor_id:          listing.seller_id,
        order_type:             'local',
        listing_id:             listing.id,
        trip_id:                null,
        product_title:          listing.title,
        product_url:            null,
        product_image:          imageUrl,
        product_platform:       'local',
        product_price_original: price,
        product_currency:       'DZD',
        platform_rate_used:     1,
        contractor_total_dzd:   price,
        deposit_dzd:            depositDzd,
        buyer_fee_dzd:          buyerFee,
        seller_fee_dzd:         sellerFee,
        upfront_dzd:            upfrontDzd,
        cod_dzd:                codDzd,
        receipt_url:            receiptUrl,
        status:                 'awaiting_verification',
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return data.id as string;
  };

  const handleSubmit = async () => {
    if (!session?.user) { router.push('/(auth)/login'); return; }
    if (!listing) return;
    if (listing.seller_id === session.user.id) {
      Alert.alert('Not allowed', "You can't order your own listing.");
      return;
    }
    if (payMethod === 'manual' && !receipt) {
      Alert.alert('Missing', 'Please upload your BaridiMob receipt.');
      return;
    }

    setSubmitting(true);
    try {
      const uid = session.user.id;

      if (payMethod === 'chargily') {
        const orderId = await createOrder(uid, null);
        const res = await fetch(`${WEB_API}/api/payments/chargily/import-checkout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            import_request_id: orderId,
            return_url: `${WEB_API}/orders/${orderId}?paid=1`,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.url) throw new Error(json.error || 'Could not start payment');
        await WebBrowser.openBrowserAsync(json.url);
        router.replace('/orders');
        return;
      }

      // Manual: upload BaridiMob receipt (RN uploads ArrayBuffer, not Blob).
      // Path MUST be receipts/<uid>/<file> — documents bucket RLS checks segment 2.
      const path = `receipts/${uid}/${Date.now()}_receipt.jpg`;
      const resp = await fetch(receipt!);
      if (!resp.ok) throw new Error(`Failed to read receipt: ${resp.status}`);
      const arrayBuffer = await resp.arrayBuffer();
      const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: false });
      if (uploadErr) throw new Error(uploadErr.message);
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);

      await createOrder(uid, urlData.publicUrl);
      Alert.alert(
        'Order Placed! ✅',
        'Your receipt is being verified by the KABA team. You will be notified once confirmed.',
        [{ text: 'Track Order', onPress: () => router.replace('/orders') }]
      );
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator color="#15803d" style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (!listing) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Securely</Text>
        </View>
        <Text style={{ textAlign: 'center', marginTop: 40, color: '#6b7280' }}>Listing not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Securely</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Product */}
        <View style={styles.productRow}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.productImg} resizeMode="cover" />
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={styles.productTitle} numberOfLines={2}>{listing.title}</Text>
            <Text style={styles.productPlatform}>In Algeria</Text>
          </View>
        </View>

        {/* Price breakdown */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment Breakdown</Text>
          <Row label="Item Price" value={formatPrice(price)} />
          <Row label="Security Deposit (20%)" value={formatPrice(depositDzd)} />
          <Row label="KABA Fee (5%)" value={formatPrice(buyerFee)} />
          <View style={styles.divider} />
          <Row label="Due Now" value={formatPrice(upfrontDzd)} bold accent />
          <View style={styles.codBox}>
            <Row label="Cash on Delivery (80%)" value={formatPrice(codDzd)} />
            <Text style={styles.codNote}>Paid to the seller when your item arrives</Text>
          </View>
        </View>

        {/* Escrow reassurance */}
        <View style={styles.shieldBox}>
          <Ionicons name="shield-checkmark" size={18} color="#15803d" />
          <Text style={styles.shieldText}>
            Your {formatPrice(depositDzd)} deposit is held by KABA — not the seller — until you
            confirm the item was delivered.
          </Text>
        </View>

        {/* Payment method selector */}
        <Text style={styles.label}>Payment Method</Text>
        <View style={styles.payRow}>
          <TouchableOpacity
            style={[styles.payCard, payMethod === 'chargily' && styles.payCardActive]}
            onPress={() => setPayMethod('chargily')}
            activeOpacity={0.85}
          >
            <Text style={styles.payEmoji}>💳</Text>
            <Text style={styles.payTitle}>Card / Edahabia</Text>
            <Text style={styles.paySub}>Pay instantly</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.payCard, payMethod === 'manual' && styles.payCardActive]}
            onPress={() => setPayMethod('manual')}
            activeOpacity={0.85}
          >
            <Text style={styles.payEmoji}>📄</Text>
            <Text style={styles.payTitle}>BaridiMob</Text>
            <Text style={styles.paySub}>Transfer + receipt</Text>
          </TouchableOpacity>
        </View>

        {payMethod === 'chargily' ? (
          <View style={styles.instructionBox}>
            <Text style={styles.instructionText}>
              You'll be redirected to Chargily to pay{' '}
              <Text style={{ fontWeight: '800' }}>{formatPrice(upfrontDzd)}</Text> securely via
              CIB or Edahabia. Your order is confirmed automatically once payment succeeds.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.instructionBox}>
              <Text style={styles.instructionTitle}>Payment Instructions</Text>
              <Text style={styles.instructionText}>
                Transfer <Text style={{ fontWeight: '800' }}>{formatPrice(upfrontDzd)}</Text> to KABA's BaridiMob account{'\n'}
                <Text style={{ fontWeight: '700' }}>RIP: 007 99999 001X</Text>{'\n'}
                Include your full name in the description.
              </Text>
            </View>

            <Text style={styles.label}>BaridiMob Receipt <Text style={{ color: '#ef4444' }}>*</Text></Text>
            {receipt ? (
              <View style={styles.receiptPreview}>
                <Image source={{ uri: receipt }} style={styles.receiptImg} resizeMode="contain" />
                <TouchableOpacity style={styles.removeReceipt} onPress={() => setReceipt(null)}>
                  <Ionicons name="close-circle" size={22} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.uploadBox} onPress={pickReceipt} activeOpacity={0.8}>
                <Ionicons name="cloud-upload-outline" size={28} color="#9ca3af" />
                <Text style={styles.uploadText}>Tap to upload receipt screenshot</Text>
                <Text style={styles.uploadHint}>JPG or PNG</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, ((payMethod === 'manual' && !receipt) || submitting) && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={(payMethod === 'manual' && !receipt) || submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.submitText}>
                {payMethod === 'chargily'
                  ? `Pay ${formatPrice(upfrontDzd)} now`
                  : `Place Order · ${formatPrice(upfrontDzd)} upfront`}
              </Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.disclaimer}>
          Your deposit is held securely by KABA until delivery is confirmed by both parties.
        </Text>
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && { fontWeight: '700', color: '#111827' }]}>{label}</Text>
      <Text style={[styles.rowValue, accent && { color: '#15803d', fontSize: 16 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  backBtn: { padding: 4, marginRight: 10 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  scroll: { padding: 16 },

  productRow: { flexDirection: 'row', gap: 10, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', padding: 12, marginBottom: 14 },
  productImg: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#f3f4f6' },
  productTitle: { fontSize: 13, fontWeight: '600', color: '#111827', lineHeight: 18, flex: 1 },
  productPlatform: { fontSize: 11, color: '#9ca3af', marginTop: 2 },

  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', padding: 14, marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  rowLabel: { fontSize: 13, color: '#6b7280' },
  rowValue: { fontSize: 13, fontWeight: '700', color: '#111827' },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 8 },
  codBox: { backgroundColor: '#fffbeb', borderRadius: 10, padding: 10, marginTop: 8 },
  codNote: { fontSize: 10, color: '#a16207', marginTop: 2 },

  shieldBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: '#f0fdf4', borderRadius: 14, borderWidth: 1, borderColor: '#bbf7d0',
    padding: 14, marginBottom: 14,
  },
  shieldText: { flex: 1, fontSize: 12, color: '#14532d', lineHeight: 18 },

  payRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  payCard: { flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 14, padding: 12, backgroundColor: '#fff' },
  payCardActive: { borderColor: '#15803d', backgroundColor: '#f0fdf4' },
  payEmoji: { fontSize: 20, marginBottom: 4 },
  payTitle: { fontSize: 13.5, fontWeight: '800', color: '#111827' },
  paySub:   { fontSize: 11, color: '#6b7280', marginTop: 1 },

  instructionBox: { backgroundColor: '#f0fdf4', borderRadius: 14, borderWidth: 1, borderColor: '#bbf7d0', padding: 14, marginBottom: 14 },
  instructionTitle: { fontSize: 13, fontWeight: '700', color: '#14532d', marginBottom: 6 },
  instructionText: { fontSize: 12, color: '#15803d', lineHeight: 18 },

  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  uploadBox: { borderWidth: 2, borderStyle: 'dashed', borderColor: '#d1d5db', borderRadius: 14, padding: 28, alignItems: 'center', gap: 6, marginBottom: 16, backgroundColor: '#fff' },
  uploadText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  uploadHint: { fontSize: 11, color: '#9ca3af' },
  receiptPreview: { borderRadius: 14, overflow: 'hidden', marginBottom: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  receiptImg: { width: '100%', height: 200 },
  removeReceipt: { position: 'absolute', top: 8, right: 8, backgroundColor: '#fff', borderRadius: 999 },

  submitBtn: { backgroundColor: '#15803d', borderRadius: 14, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  disclaimer: { fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 10, lineHeight: 16 },
});
