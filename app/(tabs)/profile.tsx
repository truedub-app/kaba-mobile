import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, Dimensions,
  ActivityIndicator, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppHeader } from '@/components/AppHeader';
import { Avatar } from '@/components/Avatar';
import { ListingCard } from '@/components/ListingCard';
import { EmptyState } from '@/components/EmptyState';
import { useAuthStore } from '@/src/hooks/useAuth';
import { supabase } from '@/src/lib/supabase';
import { formatDate } from '@/src/lib/utils';
import type { Listing, Review } from '@/src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 24 * 2 - 8) / 2;

type Tab = 'listings' | 'reviews';

export default function ProfileScreen() {
  const router = useRouter();
  const { session, profile, signOut, updateProfile, refreshProfile } = useAuthStore();

  const [activeTab, setActiveTab] = useState<Tab>('listings');
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [myReviews, setMyReviews] = useState<Review[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [loadingData, setLoadingData] = useState(false);

  // Edit modal state
  const [editVisible, setEditVisible] = useState(false);
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const loadProfileData = useCallback(async () => {
    if (!session?.user) return;
    setLoadingData(true);
    const userId = session.user.id;

    const [{ data: listData }, { data: revData }] = await Promise.all([
      supabase
        .from('listings')
        .select('*, seller:profiles!listings_seller_id_fkey(id,full_name,avatar_url,avg_rating,total_reviews,is_verified), category:categories(id,name,slug)')
        .eq('seller_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('reviews')
        .select('*, reviewer:profiles!reviews_reviewer_id_fkey(id,full_name,avatar_url)')
        .eq('seller_id', userId)
        .order('created_at', { ascending: false }),
    ]);

    const listings = (listData ?? []) as Listing[];
    setMyListings(listings);
    setActiveCount(listings.filter((l) => l.status === 'active').length);
    setMyReviews((revData ?? []) as Review[]);
    setLoadingData(false);
  }, [session?.user?.id]);

  useEffect(() => { loadProfileData(); }, [loadProfileData]);

  const openEdit = () => {
    setFullName(profile?.full_name ?? '');
    setBio(profile?.bio ?? '');
    setPhone(profile?.phone ?? '');
    setWhatsapp(profile?.whatsapp_number ?? '');
    setLocation(profile?.location ?? '');
    setEditVisible(true);
  };

  const saveProfile = async () => {
    setSaving(true);
    const err = await updateProfile({
      full_name: fullName.trim() || null,
      bio: bio.trim() || null,
      phone: phone.trim() || null,
      whatsapp_number: whatsapp.trim() || null,
      location: location.trim() || null,
    });
    setSaving(false);
    if (err) Alert.alert('Error', err);
    else setEditVisible(false);
  };

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingAvatar(true);
    try {
      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop() ?? 'jpg';
      const path = `${session!.user.id}.${ext}`;
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: `image/${ext}` });
      if (!error) {
        await updateProfile({ avatar_url: path });
        await refreshProfile();
      } else {
        Alert.alert('Upload failed', error.message);
      }
    } finally {
      setUploadingAvatar(false);
    }
  };

  const memberYear = profile?.created_at
    ? new Date(profile.created_at).getFullYear()
    : null;

  if (!session) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <AppHeader />
        <EmptyState
          emoji="👤"
          title="Sign in to view your profile"
          actionLabel="Sign In"
          onAction={() => router.push('/(auth)/login')}
        />
        <TouchableOpacity
          style={styles.createAccountBtn}
          onPress={() => router.push('/(auth)/register')}
        >
          <Text style={styles.createAccountText}>Create Account</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* ── Profile Card ── */}
        <View style={styles.profileCard}>
          {/* Row 1: Avatar | Name | Edit button */}
          <View style={styles.profileTop}>
            <TouchableOpacity
              onPress={pickAvatar}
              disabled={uploadingAvatar}
              style={styles.avatarWrap}
            >
              <Avatar
                name={profile?.full_name}
                avatarUrl={profile?.avatar_url}
                size={72}
                verified={profile?.is_verified}
              />
              {uploadingAvatar && (
                <View style={styles.avatarLoader}>
                  <ActivityIndicator color="#fff" size="small" />
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.profileNameCol}>
              <Text style={styles.profileName} numberOfLines={2}>
                {profile?.full_name ?? 'Anonymous'}
              </Text>
            </View>

            <TouchableOpacity style={styles.editProfileBtn} onPress={openEdit} activeOpacity={0.7}>
              <Ionicons name="pencil-outline" size={13} color="#15803d" />
              <Text style={styles.editProfileText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>

          {/* Row 2: Member since */}
          {memberYear && (
            <View style={styles.memberRow}>
              <Ionicons name="calendar-outline" size={14} color="#9ca3af" />
              <Text style={styles.memberText}>Member since {memberYear}</Text>
            </View>
          )}

          {/* Row 3: Active listings count + Verified badge */}
          <View style={styles.statsRow}>
            <View>
              <Text style={styles.statsNum}>{activeCount}</Text>
              <Text style={styles.statsLabel}>Active Listings</Text>
            </View>
            {(profile?.is_verified || profile?.seller_status === 'approved') && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>Verified Seller</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Quick links ── */}
        <View style={styles.quickLinks}>
          <TouchableOpacity
            style={styles.quickLink}
            activeOpacity={0.8}
            onPress={() => router.push('/orders')}
          >
            <View style={[styles.quickLinkIcon, { backgroundColor: '#f0fdf4' }]}>
              <Ionicons name="bag-outline" size={18} color="#15803d" />
            </View>
            <Text style={styles.quickLinkText}>My Orders</Text>
            <Ionicons name="chevron-forward" size={14} color="#9ca3af" />
          </TouchableOpacity>

          {(profile?.role === 'seller' || profile?.role === 'admin') && (
            <TouchableOpacity
              style={styles.quickLink}
              activeOpacity={0.8}
              onPress={() => router.push('/contractor/orders')}
            >
              <View style={[styles.quickLinkIcon, { backgroundColor: '#eff6ff' }]}>
                <Ionicons name="cube-outline" size={18} color="#1d4ed8" />
              </View>
              <Text style={styles.quickLinkText}>Order requests</Text>
              <Ionicons name="chevron-forward" size={14} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Tab switcher ── */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'listings' && styles.tabBtnActive]}
            onPress={() => setActiveTab('listings')}
          >
            <Ionicons
              name="cube-outline"
              size={14}
              color={activeTab === 'listings' ? '#15803d' : '#9ca3af'}
            />
            <Text style={[styles.tabText, activeTab === 'listings' && styles.tabTextActive]}>
              Listings ({myListings.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'reviews' && styles.tabBtnActive]}
            onPress={() => setActiveTab('reviews')}
          >
            <Ionicons
              name="star-outline"
              size={14}
              color={activeTab === 'reviews' ? '#15803d' : '#9ca3af'}
            />
            <Text style={[styles.tabText, activeTab === 'reviews' && styles.tabTextActive]}>
              Reviews ({myReviews.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Tab content ── */}
        {loadingData ? (
          <ActivityIndicator color="#15803d" style={{ marginTop: 40 }} />
        ) : activeTab === 'listings' ? (
          myListings.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="cube-outline" size={52} color="#d1d5db" />
              <Text style={styles.emptyTitle}>No listings yet</Text>
              <TouchableOpacity style={styles.createBtn} activeOpacity={0.85}>
                <Text style={styles.createBtnText}>Create your first listing</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.listingsGrid}>
              {myListings.map((item) => (
                <View key={item.id} style={{ width: CARD_WIDTH }}>
                  <ListingCard listing={item} />
                </View>
              ))}
            </View>
          )
        ) : (
          myReviews.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="star-outline" size={52} color="#d1d5db" />
              <Text style={styles.emptyTitle}>No reviews yet</Text>
            </View>
          ) : (
            <View style={{ padding: 16, gap: 12 }}>
              {myReviews.map((rev) => (
                <View key={rev.id} style={styles.reviewCard}>
                  <View style={styles.reviewTop}>
                    <Avatar
                      name={rev.reviewer?.full_name}
                      avatarUrl={rev.reviewer?.avatar_url}
                      size={36}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reviewerName}>
                        {rev.reviewer?.full_name ?? 'User'}
                      </Text>
                      <Text style={styles.reviewTime}>{formatDate(rev.created_at)}</Text>
                    </View>
                  </View>
                  <View style={styles.reviewStars}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Ionicons
                        key={s}
                        name={s <= rev.rating ? 'star' : 'star-outline'}
                        size={14}
                        color="#fbbf24"
                      />
                    ))}
                  </View>
                  {rev.comment && (
                    <Text style={styles.reviewComment}>{rev.comment}</Text>
                  )}
                </View>
              ))}
            </View>
          )
        )}
      </ScrollView>

      {/* ── Edit Profile Modal ── */}
      <Modal
        visible={editVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditVisible(false)}
      >
        <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditVisible(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={saveProfile} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color="#15803d" />
              ) : (
                <Text style={styles.modalSave}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 16 }} contentContainerStyle={{ gap: 14 }}>
            <EditField label="Full Name">
              <TextInput
                style={styles.editInput}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your name"
                placeholderTextColor="#9ca3af"
              />
            </EditField>
            <EditField label="Bio">
              <TextInput
                style={[styles.editInput, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell buyers about yourself..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
              />
            </EditField>
            <EditField label="Phone">
              <TextInput
                style={styles.editInput}
                value={phone}
                onChangeText={setPhone}
                placeholder="+213 ..."
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
              />
            </EditField>
            <EditField label="WhatsApp">
              <TextInput
                style={styles.editInput}
                value={whatsapp}
                onChangeText={setWhatsapp}
                placeholder="+213 ..."
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
              />
            </EditField>
            <EditField label="City">
              <TextInput
                style={styles.editInput}
                value={location}
                onChangeText={setLocation}
                placeholder="Algiers"
                placeholderTextColor="#9ca3af"
              />
            </EditField>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 5 }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: '#6b7280' }}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  scroll: { paddingBottom: 32 },

  /* Profile card */
  profileCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  avatarWrap: { position: 'relative' },
  avatarLoader: {
    position: 'absolute',
    inset: 0,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileNameCol: { flex: 1, paddingTop: 2 },
  profileName: { fontSize: 17, fontWeight: '700', color: '#111827', lineHeight: 23 },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: '#15803d',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  editProfileText: { fontSize: 12, color: '#15803d', fontWeight: '600' },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  memberText: { fontSize: 13, color: '#9ca3af' },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 12,
  },
  statsNum: { fontSize: 20, fontWeight: '800', color: '#111827' },
  statsLabel: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  verifiedBadge: {
    backgroundColor: '#dcfce7',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  verifiedText: { fontSize: 12, color: '#15803d', fontWeight: '700' },

  /* Quick links */
  quickLinks: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  quickLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  quickLinkIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLinkText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },

  /* Tabs */
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 10,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tabBtnActive: { borderColor: '#15803d', backgroundColor: '#f0fdf4' },
  tabText: { fontSize: 13, color: '#9ca3af', fontWeight: '500' },
  tabTextActive: { color: '#15803d', fontWeight: '700' },

  /* Empty state */
  emptyBox: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyTitle: { fontSize: 15, color: '#9ca3af', fontWeight: '500' },
  createBtn: {
    backgroundColor: '#15803d',
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 13,
    marginTop: 4,
  },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  /* Listings grid */
  listingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
  },

  /* Reviews */
  reviewCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    padding: 14,
    gap: 6,
  },
  reviewTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewerName: { fontSize: 13, fontWeight: '600', color: '#111827' },
  reviewTime: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  reviewStars: { flexDirection: 'row', gap: 2 },
  reviewComment: { fontSize: 13, color: '#374151', lineHeight: 18, marginTop: 2 },

  /* Not signed in */
  createAccountBtn: {
    marginHorizontal: 24,
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: '#15803d',
    borderRadius: 14,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createAccountText: { color: '#15803d', fontSize: 15, fontWeight: '600' },

  /* Edit modal */
  modalSafe: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  modalCancel: { fontSize: 15, color: '#9ca3af' },
  modalSave: { fontSize: 15, color: '#15803d', fontWeight: '700' },
  editInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
  },
});
