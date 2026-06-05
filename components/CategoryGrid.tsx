import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Category } from '@/src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PADDING = 16;
const NUM_COLS = 4;
const GAP = 8;
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
            activeOpacity={0.7}
          >
            <Ionicons
              name={(ICONS[cat.slug] ?? 'grid-outline') as any}
              size={22}
              color={active ? '#fff' : '#15803d'}
            />
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={2}>
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
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cellActive: {
    backgroundColor: '#15803d',
    borderColor: '#15803d',
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
    lineHeight: 13,
  },
  labelActive: {
    color: '#fff',
  },
});
