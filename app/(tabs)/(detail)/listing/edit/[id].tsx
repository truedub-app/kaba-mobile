import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Switch, Alert, ActivityIndicator,
  Image, Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuthStore } from '@/src/hooks/useAuth';
import { supabase } from '@/src/lib/supabase';
import { SelectModal } from '@/components/SelectModal';
import {
  ALGERIAN_CITIES, IMPORT_COUNTRIES,
  type ListingCondition, type Category, type Listing,
} from '@/src/types';

const CONDITIONS: ListingCondition[] = ['New', 'Like New', 'Used', 'For Parts'];
const MAX_IMAGES = 10;
const { width: W } = Dimensions.get('window');
const IMG_SIZE = (W - 32 - 8 * 2) / 3;

async function uploadImage(uri: string, userId: string): Promise<string | null> {
  try {
    const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path = `listings/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const resp = await fetch(uri);
    const blob = await resp.blob();
    const { data, error } = await supabase.storage
      .from('listing-images')
      .upload(path, blob, { contentType: ext === 'png' ? 'image/png' : 'image/jpeg' });
    if (error) return null;
    return supabase.storage.from('listing-images').getPublicUrl(data.path).data.publicUrl;
  } catch {
    return null;
  }
}

export default function EditListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [condition, setCondition] = useState<ListingCondition | null>(null);
  const [city, setCity] = useState('');
  const [originCountry, setOriginCountry] = useState('');
  const [isNegotiable, setIsNegotiable] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newImageUris, setNewImageUris] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [showCondition, setShowCondition] = useState(false);
  const [showCity, setShowCity] = useState(false);
  const [showCountry, setShowCountry] = useState(false);
  const [showCategory, setShowCategory] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from('listings').select('*').eq('id', id).single(),
      supabase.from('categories').select('id, name, slug, icon, parent_id, sort_order, created_at').order('sort_order'),
    ]).then(([{ data: l }, { data: cats }]) => {
      if (cats) setCategories(cats as Category[]);
      if (l) {
        const listing = l as Listing;
        setTitle(listing.title);
        setDescription(listing.description ?? '');
        setPrice(String(listing.price));
        setCondition(listing.condition ?? null);
        setCity(listing.city);
        setOriginCountry(listing.origin_country ?? '');
        setIsNegotiable(listing.is_negotiable);
        setCategoryId(listing.category_id ?? '');
        setExistingImages(listing.images ?? []);
      }
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#15803d" />
      </View>
    );
  }

  const totalImages = existingImages.length + newImageUris.length;

  const pickImages = async () => {
    if (totalImages >= MAX_IMAGES) {
      Alert.alert('Limit reached', `You can have up to ${MAX_IMAGES} images.`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: MAX_IMAGES - totalImages,
    });
    if (result.canceled) return;
    setNewImageUris((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, MAX_IMAGES - existingImages.length));
  };

  const validate = (): string | null => {
    if (!title.trim()) return 'Title is required.';
    if (title.length > 100) return 'Title must be 100 characters or fewer.';
    const p = parseFloat(price);
    if (!price || isNaN(p) || p <= 0) return 'Enter a valid price greater than 0.';
    if (!condition) return 'Condition is required.';
    if (!city) return 'City is required.';
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { Alert.alert('Validation', err); return; }

    setSubmitting(true);
    try {
      const userId = session!.user.id;

      // Upload new images
      const uploadedNew: string[] = [];
      for (const uri of newImageUris) {
        const url = await uploadImage(uri, userId);
        if (url) uploadedNew.push(url);
      }

      const allImages = [...existingImages, ...uploadedNew];

      const { error } = await supabase
        .from('listings')
        .update({
          title: title.trim(),
          description: description.trim() || null,
          price: parseFloat(price),
          category_id: categoryId || null,
          condition,
          city,
          origin_country: originCountry || null,
          is_negotiable: isNegotiable,
          images: allImages,
        })
        .eq('id', id)
        .eq('seller_id', userId);

      if (error) throw error;

      Alert.alert('Listing Updated', 'Your changes have been saved.', [
        { text: 'View Listing', onPress: () => router.replace(`/listing/${id}`) },
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to update listing.');
    } finally {
      setSubmitting(false);
    }
  };

  const categoryName = categories.find((c) => c.id === categoryId)?.name ?? '';

  return (
    <>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Images ── */}
        <Text style={styles.sectionTitle}>Photos</Text>
        <Text style={styles.sectionSub}>
          {totalImages}/{MAX_IMAGES} photos. Tap × to remove.
        </Text>
        <View style={styles.imageGrid}>
          {/* Existing images */}
          {existingImages.map((url, idx) => (
            <View key={`e-${url}`} style={styles.imgWrap}>
              <Image source={{ uri: url }} style={styles.img} />
              {idx === 0 && existingImages.length > 0 && (
                <View style={styles.coverBadge}><Text style={styles.coverText}>Cover</Text></View>
              )}
              <TouchableOpacity
                style={styles.removeImg}
                onPress={() => setExistingImages((prev) => prev.filter((_, i) => i !== idx))}
              >
                <Ionicons name="close-circle" size={22} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}
          {/* New images (not yet uploaded) */}
          {newImageUris.map((uri, idx) => (
            <View key={`n-${uri}`} style={styles.imgWrap}>
              <Image source={{ uri }} style={styles.img} />
              <View style={styles.newBadge}><Text style={styles.newBadgeText}>New</Text></View>
              <TouchableOpacity
                style={styles.removeImg}
                onPress={() => setNewImageUris((prev) => prev.filter((_, i) => i !== idx))}
              >
                <Ionicons name="close-circle" size={22} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}
          {totalImages < MAX_IMAGES && (
            <TouchableOpacity style={styles.addImgBtn} onPress={pickImages}>
              <Ionicons name="camera-outline" size={28} color="#9ca3af" />
              <Text style={styles.addImgText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Title ── */}
        <View style={styles.field}>
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Listing title"
            placeholderTextColor="#9ca3af"
            maxLength={100}
          />
          <Text style={[styles.charCount, title.length > 90 && styles.charCountWarn]}>
            {title.length}/100
          </Text>
        </View>

        {/* ── Category ── */}
        <View style={styles.field}>
          <Text style={styles.label}>Category</Text>
          <TouchableOpacity style={styles.picker} onPress={() => setShowCategory(true)}>
            <Text style={[styles.pickerText, !categoryName && styles.pickerPlaceholder]}>
              {categoryName || 'Select category'}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* ── Condition ── */}
        <View style={styles.field}>
          <Text style={styles.label}>Condition *</Text>
          <TouchableOpacity style={styles.picker} onPress={() => setShowCondition(true)}>
            <Text style={[styles.pickerText, !condition && styles.pickerPlaceholder]}>
              {condition || 'Select condition'}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* ── Price ── */}
        <View style={styles.field}>
          <Text style={styles.label}>Price (DZD) *</Text>
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            placeholder="e.g. 45000"
            placeholderTextColor="#9ca3af"
            keyboardType="numeric"
          />
        </View>

        {/* ── Negotiable ── */}
        <View style={styles.switchRow}>
          <View>
            <Text style={styles.label}>Price is Negotiable</Text>
            <Text style={styles.switchSub}>Buyers can make offers</Text>
          </View>
          <Switch
            value={isNegotiable}
            onValueChange={setIsNegotiable}
            trackColor={{ true: '#15803d', false: '#d1d5db' }}
            thumbColor="#fff"
          />
        </View>

        {/* ── City ── */}
        <View style={styles.field}>
          <Text style={styles.label}>City *</Text>
          <TouchableOpacity style={styles.picker} onPress={() => setShowCity(true)}>
            <Text style={[styles.pickerText, !city && styles.pickerPlaceholder]}>
              {city || 'Select city'}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* ── Origin Country ── */}
        <View style={styles.field}>
          <Text style={styles.label}>Imported From</Text>
          <TouchableOpacity style={styles.picker} onPress={() => setShowCountry(true)}>
            <Text style={[styles.pickerText, !originCountry && styles.pickerPlaceholder]}>
              {originCountry || 'Select country (optional)'}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* ── Description ── */}
        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your item…"
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* ── Submit ── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="save-outline" size={20} color="#fff" />
              <Text style={styles.submitText}>Save Changes</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Pickers ── */}
      <SelectModal visible={showCondition} title="Condition" options={CONDITIONS}
        selected={condition ?? ''} onSelect={(v) => setCondition(v as ListingCondition)}
        onClose={() => setShowCondition(false)} />
      <SelectModal visible={showCity} title="City" options={ALGERIAN_CITIES}
        selected={city} onSelect={setCity} onClose={() => setShowCity(false)} searchable />
      <SelectModal visible={showCountry} title="Imported From" options={IMPORT_COUNTRIES}
        selected={originCountry} onSelect={setOriginCountry} onClose={() => setShowCountry(false)}
        searchable allowClear clearLabel="Not imported / Local" />
      <SelectModal visible={showCategory} title="Category" options={categories.map((c) => c.name)}
        selected={categoryName}
        onSelect={(name) => { const cat = categories.find((c) => c.name === name); setCategoryId(cat?.id ?? ''); }}
        onClose={() => setShowCategory(false)} searchable allowClear clearLabel="No category" />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 16, paddingBottom: 8 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 },
  sectionSub: { fontSize: 12, color: '#9ca3af', marginBottom: 12 },

  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  imgWrap: { width: IMG_SIZE, height: IMG_SIZE, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  img: { width: '100%', height: '100%' },
  coverBadge: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(21,128,61,0.8)', paddingVertical: 3, alignItems: 'center',
  },
  coverText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  newBadge: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(59,130,246,0.8)', paddingVertical: 3, alignItems: 'center',
  },
  newBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  removeImg: { position: 'absolute', top: 4, right: 4 },
  addImgBtn: {
    width: IMG_SIZE, height: IMG_SIZE, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#d1d5db', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  addImgText: { fontSize: 11, color: '#9ca3af', fontWeight: '600' },

  field: { marginBottom: 16, gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#111827', backgroundColor: '#fff',
  },
  textarea: { minHeight: 100 },
  charCount: { fontSize: 11, color: '#9ca3af', textAlign: 'right', marginTop: -2 },
  charCountWarn: { color: '#ef4444' },
  picker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#fff',
  },
  pickerText: { fontSize: 15, color: '#111827' },
  pickerPlaceholder: { color: '#9ca3af' },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, marginBottom: 4,
  },
  switchSub: { fontSize: 12, color: '#9ca3af', marginTop: 2 },

  footer: {
    padding: 16, paddingBottom: 20,
    borderTopWidth: 1, borderTopColor: '#f3f4f6', backgroundColor: '#fff',
  },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#15803d', borderRadius: 14, paddingVertical: 16,
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnDisabled: { opacity: 0.5 },
});
