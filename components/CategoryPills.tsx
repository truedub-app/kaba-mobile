import React from 'react';
import { ScrollView, TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import type { Category } from '@/src/types';

const CATEGORY_EMOJIS: Record<string, string> = {
  electronics: '📱',
  'home-garden': '🏠',
  vehicles: '🚗',
  fashion: '👔',
  sports: '⚽',
  'books-hobbies': '📚',
  animals: '🐕',
  jobs: '💼',
};

interface Props {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function CategoryPills({ categories, selectedId, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      <TouchableOpacity
        style={[styles.pill, selectedId === null && styles.pillActive]}
        onPress={() => onSelect(null)}
        activeOpacity={0.7}
      >
        <Text style={[styles.pillText, selectedId === null && styles.pillTextActive]}>
          All
        </Text>
      </TouchableOpacity>

      {categories.map((cat) => (
        <TouchableOpacity
          key={cat.id}
          style={[styles.pill, selectedId === cat.id && styles.pillActive]}
          onPress={() => onSelect(selectedId === cat.id ? null : cat.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.emoji}>{CATEGORY_EMOJIS[cat.slug] ?? '🛍️'}</Text>
          <Text style={[styles.pillText, selectedId === cat.id && styles.pillTextActive]}>
            {cat.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pillActive: {
    backgroundColor: '#15803d',
    borderColor: '#15803d',
  },
  emoji: {
    fontSize: 14,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  pillTextActive: {
    color: '#fff',
  },
});
