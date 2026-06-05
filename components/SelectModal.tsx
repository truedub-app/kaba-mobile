import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, FlatList,
  TextInput, StyleSheet,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface Props {
  visible: boolean;
  title: string;
  options: readonly string[] | string[];
  selected: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  searchable?: boolean;
  allowClear?: boolean;
  clearLabel?: string;
}

export function SelectModal({
  visible, title, options, selected, onSelect, onClose,
  searchable, allowClear, clearLabel = 'None',
}: Props) {
  const [query, setQuery] = useState('');

  const filtered = searchable && query.trim()
    ? (options as string[]).filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : (options as string[]);

  function pick(value: string) {
    onSelect(value);
    onClose();
    setQuery('');
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Ionicons name="close" size={22} color="#374151" />
            </TouchableOpacity>
          </View>

          {searchable && (
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={16} color="#9ca3af" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search…"
                value={query}
                onChangeText={setQuery}
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
              />
            </View>
          )}

          <FlatList
            data={filtered}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              allowClear ? (
                <TouchableOpacity
                  style={[styles.option, !selected && styles.optionActive]}
                  onPress={() => pick('')}
                >
                  <Text style={[styles.optionText, !selected && styles.optionTextActive]}>
                    {clearLabel}
                  </Text>
                  {!selected && <Ionicons name="checkmark" size={18} color="#15803d" />}
                </TouchableOpacity>
              ) : null
            }
            renderItem={({ item }) => {
              const active = item === selected;
              return (
                <TouchableOpacity
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => pick(item)}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>{item}</Text>
                  {active && <Ionicons name="checkmark" size={18} color="#15803d" />}
                </TouchableOpacity>
              );
            }}
            style={{ maxHeight: 360 }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  optionActive: { backgroundColor: '#f0fdf4' },
  optionText: { fontSize: 15, color: '#374151' },
  optionTextActive: { color: '#15803d', fontWeight: '600' },
});
