import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '@/components/Avatar';
import { ListingCard } from '@/components/ListingCard';
import { supabase } from '@/src/lib/supabase';
import { useAuthStore } from '@/src/hooks/useAuth';
import { getOrCreateConversation } from '@/src/hooks/useMessages';
import type { Profile, Listing } from '@/src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_WIDTH = (SCREEN_WIDTH - 16 * 2 - 8) / 2;

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [messaging, setMessaging] = useState(false);

  const handleMessage = async () => {
    if (!session?.user) { router.push('/(auth)/login'); return; }
    if (!profile) return;
    setMessaging(true);
    const convId = await getOrCreateConversation(null, session.user.id, profile.id);
    setMessaging(false);
    if (convId) router.push(`/chat/${convId}`);
    else Alert.alert('Error', 'Could not open the conversation. Please try again.');
  };

  const handleWhatsApp = () => {
    const num = profile?.whatsapp_number?.replace(/\D/g, '');
    if (!num) return;
    Linking.openURL(`https://wa.me/${num}`).catch(() => Alert.alert('Error', 'Could not open WhatsApp'));
  };

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase
        .from('listings')
        .select(`*, category:categories(id, name, slug)`)
        .eq('seller_id', id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(30),
    ]).then(([{ data: p }, { data: l }]) => {
      setProfile(p as Profile | null);
      setListings((l ?? []) as Listing[]);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#15803d" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.loader}>
        <Text style={styles.notFound}>User not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} showsVerticalScrollIndicator={false}>
      {/* Profile header */}
      <View style={styles.header}>
        <Avatar name={profile.full_name} avatarUrl={profile.avatar_url} size={72} verified={profile.is_verified} />
        <Text style={styles.name}>{profile.full_name ?? 'Anonymous'}</Text>
        {profile.is_verified && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#15803d" />
            <Text style={styles.verifiedText}>Verified Seller</Text>
          </View>
        )}
        {profile.total_reviews > 0 && (
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={16} color="#fbbf24" />
            <Text style={styles.rating}>{profile.avg_rating.toFixed(1)}</Text>
            <Text style={styles.reviewCount}>({profile.total_reviews} reviews)</Text>
          </View>
        )}
        <Text style={styles.memberSince}>
          Member since {new Date(profile.created_at).getFullYear()}
        </Text>
      </View>

      {/* Contact buttons (hidden on your own profile) */}
      {session?.user?.id !== profile.id && (
        <View style={styles.contactRow}>
          <TouchableOpacity
            style={[styles.contactBtn, styles.msgBtn]}
            onPress={handleMessage}
            disabled={messaging}
            activeOpacity={0.85}
          >
            {messaging ? (
              <ActivityIndicator color="#15803d" size="small" />
            ) : (
              <>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color="#15803d" />
                <Text style={styles.msgBtnText}>Message</Text>
              </>
            )}
          </TouchableOpacity>
          {profile.whatsapp_number ? (
            <TouchableOpacity
              style={[styles.contactBtn, styles.waBtn]}
              onPress={handleWhatsApp}
              activeOpacity={0.85}
            >
              <Ionicons name="logo-whatsapp" size={18} color="#16a34a" />
              <Text style={styles.waBtnText}>WhatsApp</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* Bio */}
      {profile.bio && (
        <View style={styles.bioCard}>
          <Text style={styles.bio}>{profile.bio}</Text>
        </View>
      )}

      {/* Location */}
      {profile.location && (
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={15} color="#9ca3af" />
          <Text style={styles.infoText}>{profile.location}</Text>
        </View>
      )}

      {/* Listings */}
      <View style={styles.listingsSection}>
        <Text style={styles.sectionTitle}>
          Active Listings {listings.length > 0 ? `(${listings.length})` : ''}
        </Text>
        {listings.length === 0 ? (
          <Text style={styles.noListings}>No active listings</Text>
        ) : (
          <View style={styles.grid}>
            {listings.map((listing) => (
              <View key={listing.id} style={{ width: COLUMN_WIDTH }}>
                <ListingCard listing={listing} />
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { fontSize: 16, color: '#6b7280' },
  header: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  name: { fontSize: 22, fontWeight: '700', color: '#111827', marginTop: 12 },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  verifiedText: { fontSize: 13, color: '#15803d', fontWeight: '500' },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  rating: { fontSize: 15, fontWeight: '700', color: '#374151' },
  reviewCount: { fontSize: 13, color: '#9ca3af' },
  memberSince: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  contactRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 14 },
  contactBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, borderRadius: 12, height: 48, borderWidth: 1.5,
  },
  msgBtn: { borderColor: '#15803d', backgroundColor: '#f0fdf4' },
  msgBtnText: { color: '#15803d', fontWeight: '700', fontSize: 14 },
  waBtn: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  waBtnText: { color: '#15803d', fontWeight: '700', fontSize: 14 },
  bioCard: {
    margin: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 14,
  },
  bio: { fontSize: 14, color: '#374151', lineHeight: 21 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  infoText: { fontSize: 14, color: '#6b7280' },
  listingsSection: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  noListings: { fontSize: 14, color: '#9ca3af', textAlign: 'center', paddingVertical: 20 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
