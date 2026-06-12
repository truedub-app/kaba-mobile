import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuthStore } from '@/src/hooks/useAuth';
import { createTrip } from '@/src/hooks/useTrips';
import { IMPORT_COUNTRIES, countryFlag } from '@/src/types';
import { SelectModal } from '@/components/SelectModal';

// Countries a contractor can travel from (exclude Algeria — that's home)
const DESTINATION_COUNTRIES = IMPORT_COUNTRIES.filter((c) => c !== 'Algeria');

export default function CreateTripScreen() {
  const router  = useRouter();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);

  const [submitting, setSubmitting] = useState(false);
  const [showCountry,    setShowCountry]    = useState(false);
  const [sourceCountry,  setSourceCountry]  = useState('');
  const [sourceCity,     setSourceCity]     = useState('');
  const [departureDate,  setDepartureDate]  = useState('');
  const [returnDate,     setReturnDate]     = useState('');
  const [maxWeightKg,    setMaxWeightKg]    = useState('');
  const [notes,          setNotes]          = useState('');

  const isEligible = profile?.role === 'seller' || profile?.role === 'admin';

  // Compute ETA preview
  const etaPreview = returnDate
    ? new Date(
        new Date(`${returnDate}T00:00:00`).getTime() + 3 * 86_400_000
      ).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const handleSubmit = async () => {
    if (!session?.user || !isEligible) return;
    if (!sourceCountry) { Alert.alert('Missing', 'Please select the destination country.'); return; }
    if (!departureDate) { Alert.alert('Missing', 'Please enter your departure date.'); return; }
    if (!returnDate)    { Alert.alert('Missing', 'Please enter your return date.'); return; }
    if (returnDate < departureDate) {
      Alert.alert('Invalid Dates', 'Return date must be after departure date.');
      return;
    }

    setSubmitting(true);
    const { error } = await createTrip(session.user.id, {
      source_country: sourceCountry,
      source_city:    sourceCity.trim() || undefined,
      departure_date: departureDate,
      return_date:    returnDate,
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
        <Text style={styles.label}>Destination Country *</Text>
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

        {/* Dates */}
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Departure Date *</Text>
            <TextInput
              style={styles.input}
              value={departureDate}
              onChangeText={setDepartureDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Return Date *</Text>
            <TextInput
              style={styles.input}
              value={returnDate}
              onChangeText={setReturnDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
            />
          </View>
        </View>

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
        title="Destination Country"
        options={DESTINATION_COUNTRIES as unknown as string[]}
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
