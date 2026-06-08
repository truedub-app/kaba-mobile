import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '@/src/lib/supabase';
import { useImportSearch } from '@/src/hooks/useImportSearch';
import { useAuthStore } from '@/src/hooks/useAuth';
import { formatPrice } from '@/src/lib/utils';
import type { TravelTrip, Profile } from '@/src/types';

const COURIER_BUFFER = 3;

function calcETA(returnDate: string) {
  const ms = new Date(`${returnDate}T00:00:00`).getTime() + COURIER_BUFFER * 86_400_000;
  const days = Math.ceil((ms - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
  const display = new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return { days, display };
}

function calcPrices(priceDzd: number, commissionRate: number) {
  const total   = Math.round(priceDzd * (1 + commissionRate / 100));
  const deposit = Math.round(total * 0.20);
  const fee     = Math.round(total * 0.05);
  const upfront = deposit + fee;
  const cod     = total - deposit;
  return { total, deposit, fee, upfront, cod };
}

interface ContractorOption {
  trip: TravelTrip & { contractor: Profile & { commission_rate: number } };
  eta_days: number;
  eta_display: string;
  total: number;
  upfront: number;
  cod: number;
  deposit: number;
}

export default function AbroadProductScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const session = useAuthStore((s) => s.session);
  const params  = useLocalSearchParams<{
    product_url: string; product_title: string; product_image: string;
    product_platform: string; price_original: string; currency: string;
    price_dzd: string; source_country: string; flag: string;
  }>();

  const priceDzd = parseFloat(params.price_dzd ?? '0');

  const [options, setOptions]   = useState<ContractorOption[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [sort, setSort]         = useState<'price' | 'speed'>('price');

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('travel_trips')
        .select(`*, contractor:profiles!travel_trips_user_id_fkey(
          id, full_name, username, avatar_url, avg_rating, total_reviews, is_verified, commission_rate
        )`)
        .eq('source_country', params.source_country ?? '')
        .eq('status', 'active')
        .gte('return_date', today)
        .order('return_date');

      if (data) {
        const opts: ContractorOption[] = data
          .filter((t: any) => t.contractor)
          .map((t: any) => {
            const commission = t.contractor.commission_rate ?? 15;
            const prices     = calcPrices(priceDzd, commission);
            const eta        = calcETA(t.return_date);
            return { trip: t, eta_days: eta.days, eta_display: eta.display, ...prices };
          });
        setOptions(opts);
      }
      setLoading(false);
    })();
  }, [params.source_country, priceDzd]);

  const sorted = [...options].sort((a, b) =>
    sort === 'price' ? a.total - b.total : a.eta_days - b.eta_days
  );

  const cheapest = options.length ? Math.min(...options.map(o => o.total)) : 0;
  const fastest  = options.length ? Math.min(...options.map(o => o.eta_days)) : 0;

  const selectedOpt = options.find(o => o.trip.id === selected);

  const handleOrder = () => {
    if (!session?.user) {
      Alert.alert('Sign In Required', 'Please sign in to place an order.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push('/(auth)/login') },
      ]);
      return;
    }
    if (!selectedOpt) return;
    router.push({
      pathname: '/abroad/order',
      params: {
        ...params,
        trip_id:       selectedOpt.trip.id,
        contractor_id: selectedOpt.trip.contractor.id,
        total_dzd:     String(selectedOpt.total),
        upfront_dzd:   String(selectedOpt.upfront),
        cod_dzd:       String(selectedOpt.cod),
        deposit_dzd:   String(selectedOpt.deposit),
      },
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <TouchableOpacity style={[styles.backFab, { top: insets.top + 8 }]} onPress={() => router.back()} activeOpacity={0.85}>
        <Ionicons name="arrow-back" size={20} color="#111" />
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Product image */}
        <View style={styles.imgBox}>
          {params.product_image ? (
            <Image source={{ uri: params.product_image }} style={StyleSheet.absoluteFill as any} resizeMode="contain" />
          ) : (
            <Text style={{ fontSize: 60 }}>🛍️</Text>
          )}
          <View style={styles.flagBox}>
            <Text style={{ fontSize: 14 }}>{params.flag}</Text>
            <Text style={styles.flagText}>{params.product_platform}</Text>
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>{params.product_title}</Text>
          <Text style={styles.priceDzd}>{formatPrice(priceDzd)}</Text>
          <Text style={styles.priceOrig}>
            {parseFloat(params.price_original ?? '0').toLocaleString('fr-FR', {
              style: 'currency', currency: params.currency ?? 'EUR',
            })} · {params.source_country}
          </Text>

          {/* How it works */}
          <View style={styles.howBox}>
            <Text style={styles.howTitle}>How it works</Text>
            {['Choose a traveler below', 'Pay deposit via BaridiMob (25%)', 'Traveler buys & brings the item', 'Pay remaining 75% cash on delivery'].map((s, i) => (
              <Text key={i} style={styles.howStep}>{'①②③④'[i]} {s}</Text>
            ))}
          </View>

          {/* Sort tabs */}
          {options.length > 0 && (
            <View style={styles.sortRow}>
              <Text style={styles.sectionTitle}>Available Travelers ({options.length})</Text>
              <View style={styles.sortBtns}>
                {(['price', 'speed'] as const).map(s => (
                  <TouchableOpacity key={s} style={[styles.sortBtn, sort === s && styles.sortBtnActive]} onPress={() => setSort(s)}>
                    <Text style={[styles.sortBtnText, sort === s && styles.sortBtnTextActive]}>
                      {s === 'price' ? '💰 Price' : '⚡ Speed'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Contractor options */}
          {loading ? (
            <ActivityIndicator color="#15803d" style={{ marginTop: 20 }} />
          ) : options.length === 0 ? (
            <View style={styles.noContractors}>
              <Text style={{ fontSize: 32 }}>✈️</Text>
              <Text style={styles.noContractorsTitle}>No travelers available</Text>
              <Text style={styles.noContractorsText}>No verified traveler is currently heading to {params.source_country}. Check back soon.</Text>
            </View>
          ) : (
            sorted.map((opt) => {
              const isSelected = selected === opt.trip.id;
              const isCheapest = opt.total === cheapest;
              const isFastest  = opt.eta_days === fastest;
              return (
                <TouchableOpacity
                  key={opt.trip.id}
                  style={[styles.contractorCard, isSelected && styles.contractorCardSelected]}
                  onPress={() => setSelected(isSelected ? null : opt.trip.id)}
                  activeOpacity={0.88}
                >
                  <View style={styles.contractorRow}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {(opt.trip.contractor.full_name ?? '?')[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.nameRow}>
                        <Text style={styles.contractorName}>{opt.trip.contractor.full_name}</Text>
                        {opt.trip.contractor.is_verified && <Ionicons name="checkmark-circle" size={14} color="#15803d" />}
                        {isFastest && <View style={styles.badge}><Text style={styles.badgeBlue}>⚡ Fastest</Text></View>}
                        {isCheapest && <View style={styles.badge}><Text style={styles.badgeGreen}>💰 Best Price</Text></View>}
                      </View>
                      {opt.trip.contractor.total_reviews > 0 && (
                        <Text style={styles.rating}>⭐ {opt.trip.contractor.avg_rating.toFixed(1)} ({opt.trip.contractor.total_reviews})</Text>
                      )}
                      <Text style={styles.etaText}>🕐 {opt.eta_days <= 0 ? 'Today' : `${opt.eta_days}d`} · {opt.eta_display}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.totalPrice}>{formatPrice(opt.total)}</Text>
                      <Text style={styles.commissionText}>{opt.trip.contractor.commission_rate ?? 15}% comm.</Text>
                    </View>
                  </View>

                  {isSelected && (
                    <View style={styles.breakdown}>
                      <BreakdownRow label="Deposit (20%)" value={formatPrice(opt.deposit)} />
                      <BreakdownRow label="Platform fee (5%)" value={formatPrice(opt.fee)} />
                      <BreakdownRow label="Total upfront (BaridiMob)" value={formatPrice(opt.upfront)} bold accent />
                      <BreakdownRow label="Cash on delivery" value={formatPrice(opt.cod)} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* CTA */}
      {selectedOpt && (
        <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 12 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.ctaTotal}>{formatPrice(selectedOpt.upfront)} upfront</Text>
            <Text style={styles.ctaCod}>+ {formatPrice(selectedOpt.cod)} on delivery</Text>
          </View>
          <TouchableOpacity style={styles.ctaBtn} onPress={handleOrder} activeOpacity={0.88}>
            <Text style={styles.ctaBtnText}>Order →</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function BreakdownRow({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: boolean }) {
  return (
    <View style={styles.breakdownRow}>
      <Text style={[styles.breakdownLabel, bold && { fontWeight: '700', color: '#111' }]}>{label}</Text>
      <Text style={[styles.breakdownValue, accent && { color: '#15803d', fontSize: 15 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backFab: {
    position: 'absolute', left: 12, zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 999,
    padding: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  imgBox: { width: '100%', aspectRatio: 1, backgroundColor: '#f9fafb', alignItems: 'center', justifyContent: 'center' },
  flagBox: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 8, padding: 6, alignItems: 'center' },
  flagText: { fontSize: 9, color: '#6b7280', marginTop: 2 },

  content: { padding: 16 },
  title: { fontSize: 18, fontWeight: '800', color: '#111827', lineHeight: 24, marginBottom: 6 },
  priceDzd: { fontSize: 22, fontWeight: '900', color: '#15803d' },
  priceOrig: { fontSize: 12, color: '#9ca3af', marginBottom: 14 },

  howBox: { backgroundColor: '#f0fdf4', borderRadius: 12, borderWidth: 1, borderColor: '#bbf7d0', padding: 12, marginBottom: 16 },
  howTitle: { fontSize: 13, fontWeight: '700', color: '#14532d', marginBottom: 8 },
  howStep: { fontSize: 12, color: '#15803d', marginBottom: 4, lineHeight: 16 },

  sortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  sortBtns: { flexDirection: 'row', gap: 6 },
  sortBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  sortBtnActive: { borderColor: '#15803d', backgroundColor: '#f0fdf4' },
  sortBtnText: { fontSize: 11, color: '#6b7280', fontWeight: '600' },
  sortBtnTextActive: { color: '#15803d' },

  contractorCard: { borderRadius: 14, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fff', padding: 12, marginBottom: 10 },
  contractorCardSelected: { borderColor: '#15803d', backgroundColor: '#f0fdf4' },
  contractorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#15803d' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  contractorName: { fontSize: 13, fontWeight: '700', color: '#111827' },
  badge: { borderRadius: 999, paddingHorizontal: 5, paddingVertical: 2 },
  badgeBlue: { fontSize: 9, color: '#1d4ed8', fontWeight: '700' },
  badgeGreen: { fontSize: 9, color: '#15803d', fontWeight: '700' },
  rating: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  etaText: { fontSize: 11, color: '#15803d', fontWeight: '600', marginTop: 2 },
  totalPrice: { fontSize: 15, fontWeight: '900', color: '#15803d' },
  commissionText: { fontSize: 10, color: '#9ca3af', marginTop: 1 },

  breakdown: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 10 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  breakdownLabel: { fontSize: 12, color: '#6b7280' },
  breakdownValue: { fontSize: 12, fontWeight: '700', color: '#111827' },

  noContractors: { alignItems: 'center', paddingVertical: 32 },
  noContractorsTitle: { fontSize: 15, fontWeight: '700', color: '#374151', marginTop: 10, marginBottom: 4 },
  noContractorsText: { fontSize: 12, color: '#9ca3af', textAlign: 'center', lineHeight: 18 },

  ctaBar: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  ctaTotal: { fontSize: 16, fontWeight: '900', color: '#15803d' },
  ctaCod: { fontSize: 11, color: '#9ca3af' },
  ctaBtn: { backgroundColor: '#15803d', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 13 },
  ctaBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
