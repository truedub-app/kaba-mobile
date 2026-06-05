import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuthStore } from '@/src/hooks/useAuth';
import { supabase } from '@/src/lib/supabase';
import type { Listing } from '@/src/types';

const BASE_URL = 'https://www.dz-kaba.com';

const PLANS = [
  { days: 7,  price: 990,  label: '1 Week',   sub: 'Great for a quick sale' },
  { days: 14, price: 1790, label: '2 Weeks',  sub: 'Most popular boost', popular: true },
  { days: 30, price: 2990, label: '1 Month',  sub: 'Maximum visibility' },
] as const;

type Provider = 'chargily' | 'stripe';

export default function BoostListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDays, setSelectedDays] = useState<7 | 14 | 30>(14);
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('listings')
      .select('id, title, price, images, is_featured')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) setListing(data as Listing);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#15803d" />
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Listing not found.</Text>
      </View>
    );
  }

  const plan = PLANS.find((p) => p.days === selectedDays)!;

  const checkout = async (provider: Provider) => {
    if (!session) {
      router.push('/(auth)/login');
      return;
    }
    setCheckingOut(true);
    try {
      // Attempt API call with the user's JWT so the website can create the session
      const res = await fetch(`${BASE_URL}/api/payments/${provider}/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ listing_id: id, boost_days: selectedDays }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.url) {
          await WebBrowser.openBrowserAsync(json.url);
          return;
        }
      }

      // Fallback: open the website boost page directly
      await WebBrowser.openBrowserAsync(`${BASE_URL}/sell/boost/${id}`);
    } catch {
      // Fallback on network error
      await WebBrowser.openBrowserAsync(`${BASE_URL}/sell/boost/${id}`);
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Listing context ── */}
      <View style={styles.listingRow}>
        <Ionicons name="flash" size={20} color="#f59e0b" />
        <Text style={styles.listingTitle} numberOfLines={1}>{listing.title}</Text>
        {listing.is_featured && (
          <View style={styles.featuredBadge}>
            <Text style={styles.featuredText}>Active Boost</Text>
          </View>
        )}
      </View>

      {/* ── Hero text ── */}
      <Text style={styles.heroTitle}>Boost Your Listing</Text>
      <Text style={styles.heroSub}>
        Featured listings appear at the top of search results and home page, getting up to 10× more views.
      </Text>

      {/* ── Plan cards ── */}
      <Text style={styles.sectionLabel}>Choose a Plan</Text>
      {PLANS.map((p) => (
        <TouchableOpacity
          key={p.days}
          style={[styles.planCard, selectedDays === p.days && styles.planCardActive]}
          onPress={() => setSelectedDays(p.days as 7 | 14 | 30)}
          activeOpacity={0.8}
        >
          <View style={styles.planLeft}>
            {p.popular && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularText}>Most Popular</Text>
              </View>
            )}
            <Text style={[styles.planLabel, selectedDays === p.days && styles.planLabelActive]}>
              {p.label}
            </Text>
            <Text style={styles.planSub}>{p.sub}</Text>
          </View>
          <View style={styles.planRight}>
            <Text style={[styles.planPrice, selectedDays === p.days && styles.planPriceActive]}>
              {p.price.toLocaleString()} DZD
            </Text>
            <View style={[styles.radio, selectedDays === p.days && styles.radioActive]}>
              {selectedDays === p.days && <View style={styles.radioDot} />}
            </View>
          </View>
        </TouchableOpacity>
      ))}

      {/* ── Summary ── */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Duration</Text>
          <Text style={styles.summaryValue}>{plan.days} days</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total</Text>
          <Text style={styles.summaryTotal}>{plan.price.toLocaleString()} DZD</Text>
        </View>
      </View>

      {/* ── Payment providers ── */}
      <Text style={styles.sectionLabel}>Pay With</Text>

      <TouchableOpacity
        style={[styles.payBtn, checkingOut && styles.btnDisabled]}
        disabled={checkingOut}
        onPress={() => checkout('chargily')}
        activeOpacity={0.85}
      >
        {checkingOut ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="card-outline" size={20} color="#fff" />
            <View>
              <Text style={styles.payBtnLabel}>CIB / Edahabia</Text>
              <Text style={styles.payBtnSub}>Algerian debit cards</Text>
            </View>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.payBtn, styles.payBtnStripe, checkingOut && styles.btnDisabled]}
        disabled={checkingOut}
        onPress={() => checkout('stripe')}
        activeOpacity={0.85}
      >
        {checkingOut ? (
          <ActivityIndicator color="#6366f1" />
        ) : (
          <>
            <Ionicons name="globe-outline" size={20} color="#6366f1" />
            <View>
              <Text style={[styles.payBtnLabel, { color: '#6366f1' }]}>Visa / Mastercard</Text>
              <Text style={[styles.payBtnSub, { color: '#9ca3af' }]}>International cards</Text>
            </View>
          </>
        )}
      </TouchableOpacity>

      <Text style={styles.secureNote}>
        <Ionicons name="lock-closed-outline" size={12} color="#9ca3af" /> Secure payment · Boost activates instantly after payment
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 16, color: '#6b7280' },

  listingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fffbeb', borderRadius: 12,
    padding: 12, marginBottom: 20,
  },
  listingTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: '#374151' },
  featuredBadge: { backgroundColor: '#fef3c7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  featuredText: { fontSize: 11, color: '#d97706', fontWeight: '700' },

  heroTitle: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 6 },
  heroSub: { fontSize: 14, color: '#6b7280', lineHeight: 21, marginBottom: 24 },

  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 10 },

  planCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 14,
    padding: 16, marginBottom: 10,
  },
  planCardActive: { borderColor: '#15803d', backgroundColor: '#f0fdf4' },
  planLeft: { flex: 1, gap: 3 },
  popularBadge: {
    alignSelf: 'flex-start', backgroundColor: '#dcfce7',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 2,
  },
  popularText: { fontSize: 10, color: '#15803d', fontWeight: '700' },
  planLabel: { fontSize: 16, fontWeight: '700', color: '#374151' },
  planLabelActive: { color: '#15803d' },
  planSub: { fontSize: 12, color: '#9ca3af' },
  planRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planPrice: { fontSize: 15, fontWeight: '700', color: '#374151' },
  planPriceActive: { color: '#15803d' },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#d1d5db',
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: '#15803d' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#15803d' },

  summaryCard: {
    backgroundColor: '#f9fafb', borderRadius: 12,
    padding: 16, gap: 10, marginBottom: 24,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 14, color: '#6b7280' },
  summaryValue: { fontSize: 14, fontWeight: '600', color: '#111827' },
  summaryTotal: { fontSize: 18, fontWeight: '800', color: '#15803d' },

  payBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#15803d', borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 20, marginBottom: 12,
  },
  payBtnStripe: { backgroundColor: '#f5f3ff', borderWidth: 1.5, borderColor: '#e0e7ff' },
  payBtnLabel: { fontSize: 15, fontWeight: '700', color: '#fff' },
  payBtnSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 1 },
  btnDisabled: { opacity: 0.5 },

  secureNote: {
    fontSize: 12, color: '#9ca3af',
    textAlign: 'center', marginTop: 8, lineHeight: 18,
  },
});
