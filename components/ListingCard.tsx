import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Listing } from '@/src/types';
import { formatPrice, formatDate, getListingImageUrl } from '@/src/lib/utils';

const PLACEHOLDER = require('../assets/images/icon.png');

const FLAG_MAP: Record<string, string> = {
  'Saudi Arabia': '🇸🇦', China: '🇨🇳', Turkey: '🇹🇷', UAE: '🇦🇪', France: '🇫🇷',
  Germany: '🇩🇪', USA: '🇺🇸', Japan: '🇯🇵', 'South Korea': '🇰🇷', Italy: '🇮🇹',
  Spain: '🇪🇸', UK: '🇬🇧', India: '🇮🇳', Algeria: '🇩🇿',
};

interface Props {
  listing: Listing;
  onFavoriteToggle?: (id: string) => void;
  isFavorited?: boolean;
}

export function ListingCard({ listing, onFavoriteToggle, isFavorited = false }: Props) {
  const router = useRouter();
  const imageUrl = getListingImageUrl(listing.images);
  const imageCount = listing.images?.length ?? 0;
  const originFlag = listing.origin_country ? (FLAG_MAP[listing.origin_country] ?? '🌍') : null;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/listing/${listing.id}`)}
      activeOpacity={0.75}
    >
      {/* Image */}
      <View style={styles.imageWrapper}>
        <Image
          source={imageUrl ? { uri: imageUrl } : PLACEHOLDER}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />

        {/* Top-left badges */}
        <View style={styles.topLeftBadges}>
          {listing.is_featured && (
            <View style={styles.featuredBadge}>
              <Text style={styles.featuredText}>FEATURED</Text>
            </View>
          )}
          {listing.condition && (
            <View style={styles.conditionBadge}>
              <Text style={styles.conditionText}>{listing.condition}</Text>
            </View>
          )}
        </View>

        {/* Top-right: heart */}
        <TouchableOpacity
          style={styles.heartBtn}
          onPress={onFavoriteToggle ? () => onFavoriteToggle(listing.id) : undefined}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isFavorited ? 'heart' : 'heart-outline'}
            size={16}
            color={isFavorited ? '#ef4444' : '#374151'}
          />
        </TouchableOpacity>

        {/* Bottom-right: photo count */}
        {imageCount > 1 && (
          <View style={styles.photoCountBadge}>
            <Ionicons name="images-outline" size={10} color="#fff" />
            <Text style={styles.photoCountText}>{imageCount} photos</Text>
          </View>
        )}

        {/* Bottom-left: country of origin flag */}
        {originFlag && (
          <View style={styles.originBadge}>
            <Text style={styles.originFlag}>{originFlag}</Text>
            <Text style={styles.originText} numberOfLines={1}>{listing.origin_country}</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.price}>{formatPrice(listing.price)}</Text>
        <Text style={styles.title} numberOfLines={2}>{listing.title}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={11} color="#9ca3af" />
          <Text style={styles.city} numberOfLines={1}>{listing.city}</Text>
        </View>
        <Text style={styles.time}>{formatDate(listing.created_at)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    margin: 4,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  imageWrapper: {
    aspectRatio: 1,
    backgroundColor: '#f9fafb',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  topLeftBadges: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  featuredBadge: {
    backgroundColor: '#15803d',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  featuredText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  conditionBadge: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  conditionText: {
    color: '#374151',
    fontSize: 9,
    fontWeight: '600',
  },
  heartBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  photoCountBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  photoCountText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '500',
  },
  originBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    maxWidth: '70%',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  originFlag: { fontSize: 11 },
  originText: { fontSize: 9, fontWeight: '700', color: '#374151', flexShrink: 1 },
  info: {
    padding: 10,
    gap: 2,
  },
  price: {
    fontSize: 14,
    fontWeight: '800',
    color: '#15803d',
  },
  title: {
    fontSize: 12,
    color: '#111827',
    lineHeight: 16,
    marginTop: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
  },
  city: {
    fontSize: 11,
    color: '#6b7280',
    flex: 1,
  },
  time: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 2,
  },
});
