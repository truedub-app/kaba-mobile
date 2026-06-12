import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '@/src/lib/supabase';
import { useAuthStore } from '@/src/hooks/useAuth';
import { IMPORT_COUNTRIES, CONDITION_LABELS, countryFlag } from '@/src/types';
import type { TravelTrip, UsedItemCondition } from '@/src/types';
import { formatPrice } from '@/src/lib/utils';

const MAX_IMAGES = 5;
const CONDITIONS: UsedItemCondition[] = ['like_new', 'good', 'fair'];

function PickerAlert(title: string, options: string[], onSelect: (v: string) => void) {
  Alert.alert(title, undefined, [
    { text: 'Cancel', style: 'cancel' },
    ...options.map((opt) => ({ text: opt, onPress: () => onSelect(opt) })),
  ]);
}

export default function PostAbroadItemScreen() {
  const router  = useRouter();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);

  const [userId, setUserId] = useState<string | null>(null);
  const [trips, setTrips]   = useState<TravelTrip[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [title,         setTitle]         = useState('');
  const [description,   setDescription]   = useState('');
  const [condition,     setCondition]      = useState<UsedItemCondition>('good');
  const [priceDzd,      setPriceDzd]       = useState('');
  const [sourceCountry, setSourceCountry]  = useState('');
  const [sourceCity,    setSourceCity]     = useState('');
  const [tripId,        setTripId]         = useState('');
  const [images,        setImages]         = useState<string[]>([]); // local URIs

  const isEligible = profile?.role === 'seller' || profile?.role === 'admin';

  useEffect(() => {
    if (!session?.user) return;
    setUserId(session.user.id);
    supabase
      .from('travel_trips')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('status', 'active')
      .order('departure_date')
      .then(({ data }) => setTrips((data ?? []) as TravelTrip[]));
  }, [session?.user?.id]);

  const pickImages = async () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert('Limit Reached', `You can add up to ${MAX_IMAGES} photos.`);
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow photo library access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: MAX_IMAGES - images.length,
    });
    if (!result.canceled) {
      setImages((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, MAX_IMAGES));
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (uid: string): Promise<string[]> => {
    const paths: string[] = [];
    for (const uri of images) {
      const ext = uri.split('.').pop() ?? 'jpg';
      const filename = `${uid}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      // Fetch the file as a blob
      const response = await fetch(uri);
      const blob = await response.blob();
      const { error } = await supabase.storage
        .from('abroad-images')
        .upload(filename, blob, {
          contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
          upsert: false,
        });
      if (error) throw new Error(error.message);
      paths.push(`abroad-images/${filename}`);
    }
    return paths;
  };

  const handleSubmit = async () => {
    if (!userId || !isEligible) return;
    if (!title.trim())    { Alert.alert('Missing', 'Please enter a title.'); return; }
    if (!priceDzd || Number(priceDzd) <= 0) { Alert.alert('Missing', 'Enter a valid price.'); return; }
    if (!sourceCountry)   { Alert.alert('Missing', 'Select the source country.'); return; }
    if (images.length === 0) { Alert.alert('Missing', 'Add at least 1 photo.'); return; }

    setSubmitting(true);
    try {
      const imagePaths = await uploadImages(userId);
      const { data, error } = await supabase
        .from('used_international_products')
        .insert({
          contractor_id:  userId,
          title:          title.trim(),
          description:    description.trim() || null,
          condition,
          price_dzd:      Number(priceDzd),
          source_country: sourceCountry,
          source_city:    sourceCity.trim() || null,
          images:         imagePaths,
          trip_id:        tripId || null,
        })
        .select('id')
        .single();

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('Posted!', 'Your item is now live on Deals from Abroad.', [
          { text: 'View Item', onPress: () => router.push(`/abroad/${data.id}`) },
          { text: 'Done',      onPress: () => router.back() },
        ]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!session) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Sign in to post items</Text>
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
        <Text style={styles.headerTitle}>Post Abroad Item</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Photos */}
        <Text style={styles.label}>Photos * (up to {MAX_IMAGES})</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
          {images.map((uri, i) => (
            <View key={i} style={styles.photoThumb}>
              <Image source={{ uri }} style={StyleSheet.absoluteFill as any} resizeMode="cover" />
              <TouchableOpacity style={styles.removePhotoBtn} onPress={() => removeImage(i)}>
                <Ionicons name="close-circle" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
          {images.length < MAX_IMAGES && (
            <TouchableOpacity style={styles.addPhotoBtn} onPress={pickImages} activeOpacity={0.8}>
              <Ionicons name="camera-outline" size={26} color="#9ca3af" />
              <Text style={styles.addPhotoText}>Add Photo</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Title */}
        <Text style={styles.label}>Item Title *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Vintage Leica Camera — Paris Brocante"
          placeholderTextColor="#9ca3af"
          maxLength={120}
        />

        {/* Description */}
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe condition, features, what's included…"
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={1000}
        />

        {/* Condition */}
        <Text style={styles.label}>Condition *</Text>
        <View style={styles.conditionRow}>
          {CONDITIONS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.condBtn, condition === c && styles.condBtnActive]}
              onPress={() => setCondition(c)}
              activeOpacity={0.8}
            >
              <Text style={[styles.condBtnText, condition === c && styles.condBtnTextActive]}>
                {CONDITION_LABELS[c]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Price */}
        <Text style={styles.label}>Price (DZD) *</Text>
        <TextInput
          style={styles.input}
          value={priceDzd}
          onChangeText={setPriceDzd}
          placeholder="e.g. 85000"
          placeholderTextColor="#9ca3af"
          keyboardType="numeric"
        />
        {priceDzd && Number(priceDzd) > 0 && (
          <Text style={styles.pricePreview}>{formatPrice(Number(priceDzd))}</Text>
        )}

        {/* Country */}
        <Text style={styles.label}>Source Country *</Text>
        <TouchableOpacity
          style={styles.pickerBtn}
          onPress={() =>
            PickerAlert(
              'Source Country',
              IMPORT_COUNTRIES.filter((c) => c !== 'Algeria').map((c) => `${countryFlag(c)} ${c}`),
              (v) => setSourceCountry(v.replace(/^[^\s]+\s/, ''))
            )
          }
          activeOpacity={0.8}
        >
          <Text style={sourceCountry ? styles.pickerValue : styles.pickerPlaceholder}>
            {sourceCountry
              ? `${countryFlag(sourceCountry)} ${sourceCountry}`
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

        {/* Trip link */}
        <Text style={styles.label}>Link to My Trip (shows ETA to buyers)</Text>
        {trips.length === 0 ? (
          <View style={styles.noTripsBox}>
            <Text style={styles.noTripsText}>No active trips.</Text>
            <TouchableOpacity onPress={() => router.push('/trips/create')}>
              <Text style={styles.noTripsLink}>+ Register a trip first</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.pickerBtn}
            onPress={() =>
              Alert.alert('Select Trip', undefined, [
                { text: 'No trip', onPress: () => setTripId('') },
                ...trips.map((t) => ({
                  text: `${t.source_country} — returns ${t.return_date}`,
                  onPress: () => setTripId(t.id),
                })),
                { text: 'Cancel', style: 'cancel' as const },
              ])
            }
            activeOpacity={0.8}
          >
            <Text style={tripId ? styles.pickerValue : styles.pickerPlaceholder}>
              {tripId
                ? (() => {
                    const t = trips.find((x) => x.id === tripId);
                    return t ? `${t.source_country} — returns ${t.return_date}` : 'Selected';
                  })()
                : 'No trip linked'}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#9ca3af" />
          </TouchableOpacity>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
              <Text style={styles.submitText}>Post Item</Text>
            </>
          )}
        </TouchableOpacity>
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const THUMB_SIZE = 80;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },

  scroll: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 14 },

  photoRow: { flexDirection: 'row', marginBottom: 4 },
  photoThumb: {
    width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 12,
    overflow: 'hidden', marginRight: 8, backgroundColor: '#e5e7eb',
  },
  removePhotoBtn: { position: 'absolute', top: 2, right: 2 },
  addPhotoBtn: {
    width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 12,
    borderWidth: 2, borderColor: '#e5e7eb', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  addPhotoText: { fontSize: 10, color: '#9ca3af', fontWeight: '600' },

  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, color: '#111827',
  },
  textarea: { minHeight: 90 },

  conditionRow: { flexDirection: 'row', gap: 8 },
  condBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#e5e7eb',
    alignItems: 'center', backgroundColor: '#fff',
  },
  condBtnActive: { borderColor: '#15803d', backgroundColor: '#f0fdf4' },
  condBtnText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  condBtnTextActive: { color: '#15803d' },

  pricePreview: { fontSize: 13, color: '#15803d', fontWeight: '700', marginTop: 4, marginLeft: 2 },

  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
  },
  pickerValue: { fontSize: 14, color: '#111827' },
  pickerPlaceholder: { fontSize: 14, color: '#9ca3af' },

  noTripsBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1,
    borderColor: '#e5e7eb', padding: 12,
  },
  noTripsText: { fontSize: 13, color: '#9ca3af' },
  noTripsLink: { fontSize: 13, color: '#15803d', fontWeight: '600' },

  submitBtn: {
    backgroundColor: '#15803d', borderRadius: 14, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 24,
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginBottom: 12 },
  greenBtn: { backgroundColor: '#15803d', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  greenBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
