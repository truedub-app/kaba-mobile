import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '@/src/lib/supabase';
import { useAuthStore } from '@/src/hooks/useAuth';
import { getOrCreateConversation } from '@/src/hooks/useMessages';
import { fetchAbroadItemById } from '@/src/hooks/useAbroadItems';
import { formatPrice } from '@/src/lib/utils';
import { CONDITION_LABELS } from '@/src/types';
import type { UsedInternationalProduct } from '@/src/types';

const { width: W } = Dimensions.get('window');

// ── ETA (inline — no date-fns on mobile) ─────────────────────────────
function calcETA(returnDateStr: string): {
  displayDate: string;
  daysFromNow: number;
  isOverdue: boolean;
} {
  const returnMs = new Date(`${returnDateStr}T00:00:00`).getTime();
  const deliveryMs = returnMs + 3 * 86_400_000;
  const todayMs = new Date().setHours(0, 0, 0, 0);
  const daysFromNow = Math.ceil((deliveryMs - todayMs) / 86_400_000);
  const displayDate = new Date(deliveryMs).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  return { displayDate, daysFromNow, isOverdue: daysFromNow < 0 };
}

function etaBadge(d: number, overdue: boolean): string {
  if (overdue) return 'ETA passed';
  if (d === 0) return 'Arrives today';
  if (d === 1) return 'Arrives tomorrow';
  if (d <= 7)  return `Arrives in ${d} days`;
  return 'Check ETA';
}

const CONDITION_COLOR: Record<string, { bg: string; text: string }> = {
  like_new: { bg: '#dcfce7', text: '#15803d' },
  good:     { bg: '#fef9c3', text: '#a16207' },
  fair:     { bg: '#ffedd5', text: '#c2410c' },
};

export default function AbroadItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const session = useAuthStore((s) => s.session);

  const [item, setItem]       = useState<UsedInternationalProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgIndex, setImgIndex] = useState(0);

  useEffect(() => {
    if (!id) return;
    fetchAbroadItemById(id).then((data) => {
      setItem(data);
      setLoading(false);
      // Increment view count
      if (data) supabase.rpc('increment_used_product_views', { product_id: id });
    });
  }, [id]);

  const handleContact = async () => {
    if (!session?.user) {
      Alert.alert('Sign In Required', 'Please sign in to contact the contractor.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push('/(auth)/login') },
      ]);
      return;
    }
    if (!item) return;

    // One conversation per buyer↔contractor pair, regardless of which item.
    const convId = await getOrCreateConversation(null, session.user.id, item.contractor_id);
    if (convId) router.push(`/chat/${convId}`);
    else Alert.alert('Error', 'Could not start conversation. Please try again.');
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#15803d" />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Item not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const images = item.images.length > 0 ? item.images : [];
  const cStyle = CONDITION_COLOR[item.condition] ?? { bg: '#f3f4f6', text: '#374151' };
  const eta    = item.trip?.return_date ? calcETA(item.trip.return_date) : null;

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Back button (floating over image) */}
      <TouchableOpacity
        style={[styles.backFab, { top: insets.top + 8 }]}
        onPress={() => router.back()}
        activeOpacity={0.85}
      >
        <Ionicons name="arrow-back" size={20} color="#111" />
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Images ── */}
        {images.length > 0 ? (
          <View>
            <Image
              source={{ uri: images[imgIndex] }}
              style={{ width: W, height: W * 0.75, backgroundColor: '#f3f4f6' }}
              contentFit="cover"
            />
            {images.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.thumbRow}
              >
                {images.map((img, i) => (
                  <TouchableOpacity key={i} onPress={() => setImgIndex(i)}>
                    <Image
                      source={{ uri: img }}
                      style={[styles.thumb, imgIndex === i && styles.thumbActive]}
                      contentFit="cover"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        ) : (
          <View style={[styles.imagePlaceholder]}>
            <Ionicons name="image-outline" size={48} color="#d1d5db" />
          </View>
        )}

        <View style={styles.content}>
          {/* Condition + Country */}
          <View style={styles.badgeRow}>
            <View style={[styles.condBadge, { backgroundColor: cStyle.bg }]}>
              <Text style={[styles.condBadgeText, { color: cStyle.text }]}>
                {CONDITION_LABELS[item.condition]}
              </Text>
            </View>
            <View style={styles.countryBadge}>
              <Ionicons name="globe-outline" size={12} color="#6b7280" />
              <Text style={styles.countryText}>
                {item.source_country}{item.source_city ? `, ${item.source_city}` : ''}
              </Text>
            </View>
          </View>

          {/* Title + Price */}
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.price}>{formatPrice(item.price_dzd)}</Text>

          {/* ETA box */}
          {eta && (
            <View style={[styles.etaBox, eta.isOverdue && styles.etaBoxOverdue]}>
              <View style={styles.etaRow}>
                <Ionicons
                  name="time-outline"
                  size={15}
                  color={eta.isOverdue ? '#b91c1c' : '#15803d'}
                />
                <Text style={[styles.etaLabel, eta.isOverdue && { color: '#b91c1c' }]}>
                  {etaBadge(eta.daysFromNow, eta.isOverdue)}
                </Text>
              </View>
              <Text style={styles.etaSubtext}>
                Contractor returns on {item.trip?.return_date} + 3 days local courier
              </Text>
              <Text style={styles.etaDate}>Est. delivery: {eta.displayDate}</Text>
            </View>
          )}

          {/* Description */}
          {item.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.desc}>{item.description}</Text>
            </View>
          ) : null}

          {/* How it works */}
          <View style={styles.howBox}>
            <Text style={styles.howTitle}>
              <Ionicons name="cube-outline" size={13} color="#374151" />
              {'  '}How it works
            </Text>
            {[
              'Pay a 20% deposit (العربون) to secure the item',
              'Contractor brings it to Algeria on their return trip',
              'Pay remaining 80% in cash directly on delivery',
            ].map((step, i) => (
              <View key={i} style={styles.howStep}>
                <Ionicons name="checkmark-circle" size={14} color="#15803d" />
                <Text style={styles.howStepText}>{step}</Text>
              </View>
            ))}
          </View>

          {/* Contractor */}
          {item.contractor && (
            <TouchableOpacity
              style={styles.contractorCard}
              onPress={() => router.push(`/user/${item.contractor_id}`)}
              activeOpacity={0.85}
            >
              <View style={styles.contractorAvatar}>
                <Text style={styles.contractorInitial}>
                  {(item.contractor.full_name ?? item.contractor.username ?? '?')[0].toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.contractorNameRow}>
                  <Text style={styles.contractorName}>
                    {item.contractor.full_name || item.contractor.username}
                  </Text>
                  {item.contractor.is_verified && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="checkmark-circle" size={11} color="#15803d" />
                      <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                  )}
                </View>
                {item.contractor.total_reviews > 0 && (
                  <Text style={styles.contractorRating}>
                    ⭐ {item.contractor.avg_rating.toFixed(1)} ({item.contractor.total_reviews} reviews)
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
            </TouchableOpacity>
          )}

          {/* Views */}
          <Text style={styles.views}>{item.views} views</Text>
          <View style={{ height: 32 }} />
        </View>
      </ScrollView>

      {/* ── Sticky CTA ── */}
      <View style={[styles.cta, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={styles.ctaBtn} activeOpacity={0.88} onPress={handleContact}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color="#fff" />
          <Text style={styles.ctaBtnText}>Contact Contractor to Order</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  errorText: { color: '#6b7280', fontSize: 14, marginBottom: 12 },
  backBtn: { backgroundColor: '#15803d', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  backBtnText: { color: '#fff', fontWeight: '600' },

  backFab: {
    position: 'absolute', left: 12, zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 999,
    padding: 8, shadowColor: '#000', shadowOpacity: 0.12,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },

  thumbRow: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#f9fafb' },
  thumb: { width: 60, height: 60, borderRadius: 10, marginRight: 8, borderWidth: 2, borderColor: 'transparent' },
  thumbActive: { borderColor: '#15803d' },
  imagePlaceholder: { width: '100%', aspectRatio: 4/3, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },

  content: { padding: 16 },

  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  condBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  condBadgeText: { fontSize: 11, fontWeight: '700' },
  countryBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f3f4f6', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  countryText: { fontSize: 11, color: '#6b7280', fontWeight: '500' },

  title: { fontSize: 20, fontWeight: '800', color: '#111827', lineHeight: 26, marginBottom: 4 },
  price: { fontSize: 22, fontWeight: '900', color: '#15803d', marginBottom: 14 },

  etaBox: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 12, padding: 12, marginBottom: 14 },
  etaBoxOverdue: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  etaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  etaLabel: { fontSize: 13, fontWeight: '700', color: '#15803d' },
  etaSubtext: { fontSize: 11, color: '#6b7280', marginBottom: 2 },
  etaDate: { fontSize: 12, fontWeight: '600', color: '#374151' },

  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 },
  desc: { fontSize: 13, color: '#4b5563', lineHeight: 20 },

  howBox: { backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 12, marginBottom: 14 },
  howTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  howStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  howStepText: { fontSize: 12, color: '#4b5563', flex: 1, lineHeight: 17 },

  contractorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb',
    padding: 12, marginBottom: 10,
  },
  contractorAvatar: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#dcfce7',
    alignItems: 'center', justifyContent: 'center',
  },
  contractorInitial: { fontSize: 18, fontWeight: '700', color: '#15803d' },
  contractorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  contractorName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#dcfce7', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  verifiedText: { fontSize: 10, color: '#15803d', fontWeight: '600' },
  contractorRating: { fontSize: 11, color: '#6b7280', marginTop: 2 },

  views: { fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 4 },

  cta: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb', padding: 16, paddingTop: 12 },
  ctaBtn: {
    backgroundColor: '#15803d', borderRadius: 14, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14,
  },
  ctaBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
