import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from './Avatar';
import type { Profile } from '@/src/types';

interface Props {
  seller: Profile;
  onWhatsApp?: () => void;
}

export function SellerCard({ seller }: Props) {
  const router = useRouter();

  const memberYear = seller.created_at
    ? new Date(seller.created_at).getFullYear()
    : null;

  const roleLabel =
    seller.role === 'seller'
      ? 'Seller'
      : seller.role === 'admin'
      ? 'Admin'
      : 'Member';

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Seller</Text>

      {/* Avatar + name + meta */}
      <View style={styles.row}>
        <Avatar
          name={seller.full_name}
          avatarUrl={seller.avatar_url}
          size={52}
          verified={seller.is_verified}
        />
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {seller.full_name ?? 'Anonymous'}
            </Text>
            {seller.is_verified && (
              <Ionicons name="checkmark-circle" size={15} color="#15803d" />
            )}
          </View>
          <Text style={styles.meta}>
            {roleLabel}
            {memberYear ? ` · Member since ${memberYear}` : ''}
          </Text>
          {seller.total_reviews > 0 && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={13} color="#fbbf24" />
              <Text style={styles.rating}>
                {seller.avg_rating.toFixed(1)}
              </Text>
              <Text style={styles.reviewCount}>
                ({seller.total_reviews} reviews)
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* View Profile button */}
      <TouchableOpacity
        style={styles.profileBtn}
        onPress={() => router.push(`/user/${seller.id}`)}
        activeOpacity={0.75}
      >
        <Text style={styles.profileBtnText}>View Profile</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  heading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  info: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    flexShrink: 1,
  },
  meta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 3,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  rating: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  reviewCount: {
    fontSize: 12,
    color: '#6b7280',
  },
  profileBtn: {
    marginTop: 14,
    borderWidth: 1.5,
    borderColor: '#15803d',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  profileBtnText: {
    color: '#15803d',
    fontWeight: '700',
    fontSize: 14,
  },
});
