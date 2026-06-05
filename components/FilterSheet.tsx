import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ListingFilters, ListingCondition } from '@/src/types';
import { ALGERIAN_CITIES } from '@/src/types';

interface Props {
  visible: boolean;
  filters: ListingFilters;
  onApply: (f: ListingFilters) => void;
  onClose: () => void;
}

const CONDITIONS: ListingCondition[] = ['New', 'Like New', 'Used', 'For Parts'];
const SORTS = [
  { label: 'Newest', value: 'newest' as const },
  { label: 'Oldest', value: 'oldest' as const },
  { label: 'Price: Low to High', value: 'price_asc' as const },
  { label: 'Price: High to Low', value: 'price_desc' as const },
];

export function FilterSheet({ visible, filters, onApply, onClose }: Props) {
  const [draft, setDraft] = useState<ListingFilters>(filters);

  const toggle = <K extends keyof ListingFilters>(key: K, value: ListingFilters[K]) => {
    setDraft((prev) => ({ ...prev, [key]: prev[key] === value ? undefined : value }));
  };

  const toggleCity = (city: string) => {
    setDraft((prev) => {
      const cities = prev.cities ?? [];
      return {
        ...prev,
        cities: cities.includes(city) ? cities.filter((c) => c !== city) : [...cities, city],
      };
    });
  };

  const reset = () => setDraft({});

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.title}>Filters</Text>
          <TouchableOpacity onPress={reset}>
            <Text style={styles.reset}>Reset</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {/* Sort */}
          <Section title="Sort By">
            <View style={styles.chips}>
              {SORTS.map((s) => (
                <Chip
                  key={s.value}
                  label={s.label}
                  active={draft.sort === s.value}
                  onPress={() => toggle('sort', s.value)}
                />
              ))}
            </View>
          </Section>

          {/* Condition */}
          <Section title="Condition">
            <View style={styles.chips}>
              {CONDITIONS.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  active={draft.condition === c}
                  onPress={() => toggle('condition', c)}
                />
              ))}
            </View>
          </Section>

          {/* Price range */}
          <Section title="Price Range (DA)">
            <View style={styles.priceRow}>
              <TextInput
                style={styles.priceInput}
                placeholder="Min"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                value={draft.min_price != null ? String(draft.min_price) : ''}
                onChangeText={(t) =>
                  setDraft((prev) => ({ ...prev, min_price: t ? Number(t) : undefined }))
                }
              />
              <Text style={styles.priceSep}>–</Text>
              <TextInput
                style={styles.priceInput}
                placeholder="Max"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                value={draft.max_price != null ? String(draft.max_price) : ''}
                onChangeText={(t) =>
                  setDraft((prev) => ({ ...prev, max_price: t ? Number(t) : undefined }))
                }
              />
            </View>
          </Section>

          {/* Cities */}
          <Section title="City">
            <View style={styles.chips}>
              {ALGERIAN_CITIES.slice(0, 15).map((city) => (
                <Chip
                  key={city}
                  label={city}
                  active={(draft.cities ?? []).includes(city)}
                  onPress={() => toggleCity(city)}
                />
              ))}
            </View>
          </Section>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.applyBtn}
            onPress={() => {
              onApply(draft);
              onClose();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.applyText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  title: { fontSize: 17, fontWeight: '700', color: '#111827' },
  reset: { fontSize: 14, color: '#15803d', fontWeight: '500' },
  body: { paddingHorizontal: 20, paddingBottom: 20 },
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  chipActive: { backgroundColor: '#15803d', borderColor: '#15803d' },
  chipText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  priceInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#111827',
  },
  priceSep: { fontSize: 18, color: '#9ca3af' },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  applyBtn: {
    backgroundColor: '#15803d',
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
