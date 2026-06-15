import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Linking } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { formatDate, formatPrice } from '@/src/lib/utils';
import type { Message } from '@/src/types';

const MAX_IMAGE_WIDTH = Dimensions.get('window').width * 0.65;

interface Props {
  message: Message;
  isMine: boolean;
}

export function MessageBubble({ message, isMine }: Props) {
  const router = useRouter();

  // Product card message
  if (message.product_title) {
    const openProduct = () => {
      if (message.product_listing_id) router.push(`/listing/${message.product_listing_id}`);
      else if (message.product_url) Linking.openURL(message.product_url).catch(() => {});
    };
    return (
      <View style={[styles.wrapper, isMine ? styles.wrapperMine : styles.wrapperOther]}>
        <TouchableOpacity style={styles.productCard} activeOpacity={0.85} onPress={openProduct}>
          {message.product_image ? (
            <Image source={{ uri: message.product_image }} style={styles.productImage} contentFit="cover" />
          ) : (
            <View style={[styles.productImage, styles.productImagePlaceholder]}>
              <Ionicons name="cube-outline" size={26} color="#9ca3af" />
            </View>
          )}
          <View style={styles.productInfo}>
            <Text style={styles.productTitle} numberOfLines={2}>{message.product_title}</Text>
            {message.product_price != null && (
              <Text style={styles.productPrice}>{formatPrice(message.product_price)}</Text>
            )}
            <View style={styles.productOpen}>
              <Ionicons name="open-outline" size={12} color="#15803d" />
              <Text style={styles.productOpenText}>View product</Text>
            </View>
          </View>
        </TouchableOpacity>
        <Text style={[styles.time, isMine ? styles.timeMine : styles.timeOther]}>
          {formatDate(message.created_at)}
          {isMine && message.read_at && '  ✓✓'}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, isMine ? styles.wrapperMine : styles.wrapperOther]}>
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
        {message.image_url && (
          <Image
            source={{ uri: message.image_url }}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />
        )}
        {message.content && (
          <Text style={[styles.text, isMine ? styles.textMine : styles.textOther]}>
            {message.content}
          </Text>
        )}
      </View>
      <Text style={[styles.time, isMine ? styles.timeMine : styles.timeOther]}>
        {formatDate(message.created_at)}
        {isMine && message.read_at && '  ✓✓'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 3,
    paddingHorizontal: 12,
    maxWidth: '80%',
  },
  wrapperMine: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  wrapperOther: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    overflow: 'hidden',
  },
  bubbleMine: {
    backgroundColor: '#15803d',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#f3f4f6',
    borderBottomLeftRadius: 4,
  },
  image: {
    width: MAX_IMAGE_WIDTH,
    height: MAX_IMAGE_WIDTH * 0.75,
    borderRadius: 12,
    marginBottom: 4,
  },
  text: {
    fontSize: 15,
    lineHeight: 21,
  },
  textMine: {
    color: '#fff',
  },
  textOther: {
    color: '#111827',
  },
  time: {
    fontSize: 10,
    marginTop: 3,
    color: '#9ca3af',
  },
  timeMine: {
    color: '#86efac',
  },
  timeOther: {
    color: '#9ca3af',
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    width: MAX_IMAGE_WIDTH,
  },
  productImage: { width: 72, height: 72, backgroundColor: '#f3f4f6' },
  productImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  productInfo: { flex: 1, padding: 8, justifyContent: 'center', gap: 2 },
  productTitle: { fontSize: 13, fontWeight: '600', color: '#111827', lineHeight: 17 },
  productPrice: { fontSize: 14, fontWeight: '800', color: '#15803d' },
  productOpen: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  productOpenText: { fontSize: 11, color: '#15803d', fontWeight: '700' },
});
