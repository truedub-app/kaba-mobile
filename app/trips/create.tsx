import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuthStore } from '@/src/hooks/useAuth';
import { createTrip } from '@/src/hooks/useTrips';
import { IMPORT_COUNTRIES, countryFlag } from '@/src/types';
import { SelectModal } from '@/components/SelectModal';

// Countries a contractor can import from (exclude Algeria — that's home)
const IMPORT_FROM_COUNTRIES = IMPORT_COUNTRIES.filter((c) => c !== 'Algeria');

/** Format a Date as local YYYY-MM-DD (no UTC shift) */
function toDateString(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function CreateTripScreen() {
  const router  = useRouter();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);

  const [submitting, setSubmitting] = useState(false);
  const [showCountry,    setShowCountry]    = useState(false);
  const [sourceCountry,  setSourceCountry]  = useState('');
  const [sourceCity,     setSourceCity]     = useState('');
  const [arrivalDate,    setArrivalDate]    = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [maxWeightKg,    setMaxWeightKg]    = useState('');
  const [notes,          setNotes]          = useState('');

  const isEligible = profile?.role === 'seller' || profile?.role === 'admin';

  // Compute ETA preview (arrival + 3-day courier buffer)
  const etaPreview = arrivalDate
    ? new Date(arrivalDate.getTime() + 3 * 86_400_000)
        .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const handleSubmit = async () => {
    if (!session?.user || !isEligible) return;
    if (!sourceCountry) { Alert.alert('Missing', 'Please select the country of import.'); return; }
    if (!arrivalDate)   { Alert.alert('Missing', 'Please select your arrival date.'); return; }

    setSubmitting(true);
    const { error } = await createTrip(session.user.id, {
      source_country: sourceCountry,
      source_city:    sourceCity.trim() || undefined,
      // departure isn't shown to users anymore — the trip is live from today
      departure_date: toDateString(new Date()),
      return_date:    toDateString(arrivalDate),
      max_weight_kg:  maxWeightKg ? Number(maxWeightKg) : undefined,
      notes:          notes.trim() || undefined,
    });
    setSubmitting(false);

    if (error) {
      Alert.alert('Error', error);
    } else {
      Alert.alert('Trip Registered!', 'Your trip is now visible to buyers.', [
        { text: 'Done', onPress: () => router.back() },
      ]);
    }
  };

  if (!session) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.label}>Please sign in first.</Text>
          <TouchableOpacity style={styles.greenBtn} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.greenBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Register a Trip</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.hint}>
          Tell buyers where you're going and when you'll be back, so they can order ahead.
        </Text>

        {/* Country */}
        <Text style={styles.label}>بلد الاستيراد | Country of Import *</Text>
        <TouchableOpacity
          style={styles.pickerBtn}
          onPress={() => setShowCountry(true)}
          activeOpacity={0.8}
        >
          <Text style={sourceCountry ? styles.pickerValue : styles.pickerPlaceholder}>
            {sourceCountry
              ? `${countryFlag(sourceCountry)}  ${sourceCountry}`
              : 'Select country…'}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#9ca3af" />
        </TouchableOpacity>

        {/* City */}
        <Text style={styles.label}>City (optional)</Text>
        <TextInput
          style={styles.input}
          value={sourceCity}
          onChangeText={setSourceCity}
          placeholder="e.g. Paris"
          placeholderTextColor="#9ca3af"
        />

        {/* Arrival date */}
        <Text style={styles.label}>الوصول إلى الجزائر | Arriving to Algeria *</Text>
        <TouchableOpacity
          style={styles.pickerBtn}
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.8}
        >
          <Text style={arrivalDate ? styles.pickerValue : styles.pickerPlaceholder}>
            {arrivalDate
              ? arrivalDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
              : 'Select date…'}
          </Text>
          <Ionicons name="calendar-outline" size={16} color="#9ca3af" />
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={arrivalDate ?? new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            minimumDate={new Date()}
            onChange={(_event, date) => {
              setShowDatePicker(false);
              if (date) setArrivalDate(date);
            }}
            accentColor="#15803d"
          />
        )}

        {/* ETA Preview */}
        {etaPreview && (
          <View style={styles.etaPreview}>
            <Ionicons name="time-outline" size={14} color="#15803d" />
            <Text style={styles.etaText}>
              Buyer ETA will show: <Text style={{ fontWeight: '700' }}>{etaPreview}</Text>
            </Text>
          </View>
        )}

        {/* Max weight */}
        <Text style={styles.label}>Max Carry Weight (kg) — optional</Text>
        <TextInput
          style={styles.input}
          value={maxWeightKg}
          onChangeText={setMaxWeightKg}
          placeholder="e.g. 10"
          placeholderTextColor="#9ca3af"
          keyboardType="decimal-pad"
        />

        {/* Notes */}
        <Text style={styles.label}>Notes — optional</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="e.g. Can carry electronics, will have 20kg baggage allowance…"
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* Submit */}
        <TouchableOpacity
          style={[styles.greenBtn, submitting && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.greenBtnText}>Register Trip</Text>}
        </TouchableOpacity>
      </ScrollView>

      <SelectModal
        visible={showCountry}
        title="Country of Import"
        options={IMPORT_FROM_COUNTRIES as unknown as string[]}
        selected={sourceCountry}
        onSelect={setSourceCountry}
        onClose={() => setShowCountry(false)}
        searchable
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },

  scroll: { padding: 16, gap: 6 },
  hint: { fontSize: 13, color: '#6b7280', marginBottom: 16, lineHeight: 18 },

  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: '#111827',
  },
  textarea: { minHeight: 80 },

  row: { flexDirection: 'row', gap: 10 },

  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  pickerValue: { fontSize: 14, color: '#111827' },
  pickerPlaceholder: { fontSize: 14, color: '#9ca3af' },

  etaPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0',
    borderRadius: 10, padding: 10, marginTop: 8,
  },
  etaText: { fontSize: 12, color: '#15803d', flex: 1 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  greenBtn: {
    backgroundColor: '#15803d', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: 20,
  },
  greenBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
