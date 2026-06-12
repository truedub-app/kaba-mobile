import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Category } from '@/src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PADDING = 16;
const NUM_COLS = 3;
const GAP = 10;
const CELL_SIZE = (SCREEN_WIDTH - PADDING * 2 - GAP * (NUM_COLS - 1)) / NUM_COLS;

const ICONS: Record<string, string> = {
  electronics: 'phone-portrait-outline',
  'home-garden': 'home-outline',
  vehicles: 'car-outline',
  fashion: 'shirt-outline',
  sports: 'football-outline',
  'books-hobbies': 'book-outline',
  animals: 'paw-outline',
  jobs: 'briefcase-outline',
  services: 'construct-outline',
  beauty: 'sparkles-outline',
  other: 'grid-outline',
};

interface Props {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function CategoryGrid({ categories, selectedId, onSelect }: Props) {
  return (
    <View style={styles.grid}>
      {categories.map((cat) => {
        const active = selectedId === cat.id;
        return (
          <TouchableOpacity
            key={cat.id}
            style={[styles.cell, active && styles.cellActive]}
            onPress={() => onSelect(active ? null : cat.id)}
            activeOpacity={0.8}
          >
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <Ionicons
                name={(ICONS[cat.slug] ?? 'grid-outline') as any}
                size={24}
                color={active ? '#fff' : '#15803d'}
              />
            </View>
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: PADDING,
    gap: GAP,
  },
  cell: {
    width: CELL_SIZE,
    paddingVertical: 16,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cellActive: {
    backgroundColor: '#f0fdf4',
    borderColor: '#15803d',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: '#15803d',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  labelActive: {
    color: '#15803d',
    fontWeight: '700',
  },
});
