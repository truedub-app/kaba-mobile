import React, { useState, useRef } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getListingImageUrl } from '@/src/lib/utils';

const PLACEHOLDER = require('../assets/images/icon.png');
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
  images: string[];
  height?: number;
  width?: number;
}

export function ImageCarousel({ images, height = 320, width = SCREEN_WIDTH }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const items = images.length > 0 ? images : [''];

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveIndex(index);
  };

  const go = (direction: 'prev' | 'next') => {
    const next =
      direction === 'next'
        ? Math.min(activeIndex + 1, items.length - 1)
        : Math.max(activeIndex - 1, 0);
    flatListRef.current?.scrollToIndex({ index: next, animated: true });
    setActiveIndex(next);
  };

  return (
    <View style={[styles.container, { height, width }]}>
      <FlatList
        ref={flatListRef}
        data={items}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyExtractor={(_, i) => String(i)}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        renderItem={({ item }) => {
          const url = item ? getListingImageUrl([item]) : null;
          return (
            <Image
              source={url ? { uri: url } : PLACEHOLDER}
              style={{ width, height }}
              contentFit="cover"
              transition={200}
            />
          );
        }}
      />

      {/* Arrows */}
      {items.length > 1 && activeIndex > 0 && (
        <TouchableOpacity style={[styles.arrow, styles.arrowLeft]} onPress={() => go('prev')}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>
      )}
      {items.length > 1 && activeIndex < items.length - 1 && (
        <TouchableOpacity style={[styles.arrow, styles.arrowRight]} onPress={() => go('next')}>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Dots */}
      {items.length > 1 && (
        <View style={styles.dots}>
          {items.map((_, i) => (
            <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
          ))}
        </View>
      )}

      {/* Counter */}
      {items.length > 1 && (
        <View style={styles.counter}>
          <Ionicons name="images-outline" size={12} color="#fff" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: '#f3f4f6',
  },
  arrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowLeft: { left: 12 },
  arrowRight: { right: 12 },
  dots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 16,
  },
  counter: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 999,
    padding: 6,
  },
});
