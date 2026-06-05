import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuthStore } from '@/src/hooks/useAuth';
import { supabase } from '@/src/lib/supabase';
import { IMPORT_COUNTRIES } from '@/src/types';
import { SelectModal } from '@/components/SelectModal';
import type { SellerType } from '@/src/types';

const SELLER_TYPES: SellerType[] = ['Foreign Resident', 'Algerian Self-Entrepreneur'];

const STEPS = ['Seller Type', 'Personal Info', 'Document', 'Done'];

export default function SellerApplyScreen() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);

  const [step, setStep] = useState(0);
  const [sellerType, setSellerType] = useState<SellerType | null>(null);
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp_number ?? '');
  const [country, setCountry] = useState('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [docUri, setDocUri] = useState<string | null>(null);
  const [docName, setDocName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!session) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Please sign in first</Text>
        <TouchableOpacity style={styles.greenBtn} onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.greenBtnText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (profile?.role === 'seller' || profile?.role === 'admin') {
    return (
      <View style={styles.centered}>
        <Ionicons name="checkmark-circle" size={56} color="#15803d" />
        <Text style={styles.emptyTitle}>You're already a seller!</Text>
        <TouchableOpacity style={styles.greenBtn} onPress={() => router.replace('/(tabs)/seller-dashboard')}>
          <Text style={styles.greenBtnText}>Go to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (profile?.seller_status === 'pending') {
    return (
      <View style={styles.centered}>
        <Ionicons name="time-outline" size={56} color="#f59e0b" />
        <Text style={styles.emptyTitle}>Application Under Review</Text>
        <Text style={styles.emptySub}>
          We'll notify you once your application has been reviewed. This usually takes 1-2 business days.
        </Text>
        <TouchableOpacity style={styles.outlineBtn} onPress={() => router.back()}>
          <Text style={styles.outlineBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Step indicators ────────────────────────────────────────────────────────
  const StepBar = () => (
    <View style={styles.stepBar}>
      {STEPS.map((label, i) => (
        <View key={i} style={styles.stepItem}>
          <View style={[styles.stepDot, i <= step && styles.stepDotActive]}>
            {i < step ? (
              <Ionicons name="checkmark" size={12} color="#fff" />
            ) : (
              <Text style={[styles.stepNum, i === step && styles.stepNumActive]}>{i + 1}</Text>
            )}
          </View>
          {i < STEPS.length - 1 && (
            <View style={[styles.stepLine, i < step && styles.stepLineActive]} />
          )}
        </View>
      ))}
    </View>
  );

  // ── Step 0: Seller type ────────────────────────────────────────────────────
  const Step0 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>What type of seller are you?</Text>
      <Text style={styles.stepSub}>Choose the option that best describes your situation.</Text>
      <View style={styles.typeCards}>
        {SELLER_TYPES.map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.typeCard, sellerType === type && styles.typeCardActive]}
            onPress={() => setSellerType(type)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={type === 'Foreign Resident' ? 'earth-outline' : 'briefcase-outline'}
              size={28}
              color={sellerType === type ? '#15803d' : '#6b7280'}
            />
            <Text style={[styles.typeLabel, sellerType === type && styles.typeLabelActive]}>
              {type}
            </Text>
            {sellerType === type && (
              <View style={styles.typeCheck}>
                <Ionicons name="checkmark-circle" size={20} color="#15803d" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        style={[styles.nextBtn, !sellerType && styles.btnDisabled]}
        disabled={!sellerType}
        onPress={() => setStep(1)}
      >
        <Text style={styles.nextBtnText}>Continue</Text>
        <Ionicons name="arrow-forward" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  // ── Step 1: Personal info ──────────────────────────────────────────────────
  const Step1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Personal Information</Text>
      <Text style={styles.stepSub}>This information will be used to verify your identity.</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Full Name *</Text>
        <TextInput
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
          placeholder="Your full legal name"
          placeholderTextColor="#9ca3af"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>WhatsApp Number *</Text>
        <TextInput
          style={styles.input}
          value={whatsapp}
          onChangeText={setWhatsapp}
          placeholder="+213 555 000 000"
          placeholderTextColor="#9ca3af"
          keyboardType="phone-pad"
        />
        <Text style={styles.hint}>Include country code (e.g. +213 for Algeria)</Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Country of Residence *</Text>
        <TouchableOpacity style={styles.picker} onPress={() => setShowCountryPicker(true)}>
          <Text style={[styles.pickerText, !country && styles.pickerPlaceholder]}>
            {country || 'Select country'}
          </Text>
          <Ionicons name="chevron-down" size={18} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      <SelectModal
        visible={showCountryPicker}
        title="Country of Residence"
        options={IMPORT_COUNTRIES}
        selected={country}
        onSelect={setCountry}
        onClose={() => setShowCountryPicker(false)}
        searchable
      />

      <View style={styles.rowBtns}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setStep(0)}>
          <Ionicons name="arrow-back" size={18} color="#374151" />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextBtn, { flex: 1 }, (!fullName.trim() || !whatsapp.trim() || !country) && styles.btnDisabled]}
          disabled={!fullName.trim() || !whatsapp.trim() || !country}
          onPress={() => setStep(2)}
        >
          <Text style={styles.nextBtnText}>Continue</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Step 2: Document upload ────────────────────────────────────────────────
  const pickDocument = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setDocUri(asset.uri);
    setDocName(asset.fileName ?? `document.${asset.uri.split('.').pop() ?? 'jpg'}`);
  };

  const handleSubmit = async () => {
    if (!docUri || !session) return;
    setSubmitting(true);
    try {
      const userId = session.user.id;
      const ext = docUri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `seller-docs/${userId}/${Date.now()}.${ext}`;

      const response = await fetch(docUri);
      const blob = await response.blob();

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(path, blob, { contentType: ext === 'png' ? 'image/png' : 'image/jpeg' });

      if (uploadError) throw uploadError;

      const sizeKb = Math.round(blob.size / 1024);

      // Upsert seller application
      const { error: appError } = await supabase
        .from('seller_applications')
        .upsert({
          user_id: userId,
          seller_type: sellerType,
          applicant_name: fullName.trim(),
          whatsapp_number: whatsapp.trim(),
          residence_country: country,
          document_url: uploadData.path,
          document_name: docName,
          document_size_kb: sizeKb,
          status: 'pending',
        }, { onConflict: 'user_id' });

      if (appError) throw appError;

      // Mark profile as pending
      await supabase
        .from('profiles')
        .update({ seller_status: 'pending', whatsapp_number: whatsapp.trim() })
        .eq('id', userId);

      setStep(3);
    } catch (err: any) {
      Alert.alert('Submission Failed', err.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const Step2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Upload Your Document</Text>
      <Text style={styles.stepSub}>
        Upload a photo of your national ID, passport, or business registration document.
      </Text>

      <TouchableOpacity style={styles.docPicker} onPress={pickDocument} activeOpacity={0.8}>
        {docUri ? (
          <Image source={{ uri: docUri }} style={styles.docPreview} resizeMode="cover" />
        ) : (
          <>
            <View style={styles.docIconWrap}>
              <Ionicons name="cloud-upload-outline" size={32} color="#15803d" />
            </View>
            <Text style={styles.docPickerText}>Tap to upload document photo</Text>
            <Text style={styles.docPickerHint}>JPG or PNG • max 5MB</Text>
          </>
        )}
      </TouchableOpacity>

      {docUri && (
        <TouchableOpacity style={styles.changeDoc} onPress={pickDocument}>
          <Ionicons name="refresh-outline" size={16} color="#6b7280" />
          <Text style={styles.changeDocText}>Change photo</Text>
        </TouchableOpacity>
      )}

      <View style={styles.rowBtns}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
          <Ionicons name="arrow-back" size={18} color="#374151" />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextBtn, { flex: 1 }, (!docUri || submitting) && styles.btnDisabled]}
          disabled={!docUri || submitting}
          onPress={handleSubmit}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Text style={styles.nextBtnText}>Submit Application</Text>
              <Ionicons name="send-outline" size={18} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Step 3: Success ────────────────────────────────────────────────────────
  const Step3 = () => (
    <View style={styles.successBox}>
      <View style={styles.successIcon}>
        <Ionicons name="checkmark-circle" size={64} color="#15803d" />
      </View>
      <Text style={styles.successTitle}>Application Submitted!</Text>
      <Text style={styles.successSub}>
        Your seller application is under review. We'll notify you within 1-2 business days.
      </Text>
      <TouchableOpacity style={styles.greenBtn} onPress={() => router.replace('/(tabs)')}>
        <Text style={styles.greenBtnText}>Back to Home</Text>
      </TouchableOpacity>
    </View>
  );

  const STEP_COMPONENTS = [<Step0 key={0} />, <Step1 key={1} />, <Step2 key={2} />, <Step3 key={3} />];

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <StepBar />
      {STEP_COMPONENTS[step]}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },

  /* Step bar */
  stepBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 24,
    paddingBottom: 32,
  },
  stepItem: { flexDirection: 'row', alignItems: 'center' },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: '#15803d' },
  stepNum: { fontSize: 12, color: '#9ca3af', fontWeight: '700' },
  stepNumActive: { color: '#fff' },
  stepLine: { width: 32, height: 2, backgroundColor: '#e5e7eb', marginHorizontal: 4 },
  stepLineActive: { backgroundColor: '#15803d' },

  /* Step content */
  stepContent: { gap: 16 },
  stepTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  stepSub: { fontSize: 14, color: '#6b7280', lineHeight: 21, marginTop: -8 },

  /* Seller type cards */
  typeCards: { gap: 12 },
  typeCard: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 20,
    gap: 8,
    position: 'relative',
  },
  typeCardActive: { borderColor: '#15803d', backgroundColor: '#f0fdf4' },
  typeLabel: { fontSize: 16, fontWeight: '700', color: '#374151' },
  typeLabelActive: { color: '#15803d' },
  typeCheck: { position: 'absolute', top: 16, right: 16 },

  /* Fields */
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fff',
  },
  hint: { fontSize: 12, color: '#9ca3af' },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  pickerText: { fontSize: 15, color: '#111827' },
  pickerPlaceholder: { color: '#9ca3af' },

  /* Document upload */
  docPicker: {
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    borderRadius: 16,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  docIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docPickerText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  docPickerHint: { fontSize: 12, color: '#9ca3af' },
  docPreview: { width: '100%', height: '100%' },
  changeDoc: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: -8,
  },
  changeDocText: { fontSize: 13, color: '#6b7280' },

  /* Buttons */
  rowBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#15803d',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  backBtnText: { fontSize: 15, color: '#374151', fontWeight: '600' },
  btnDisabled: { opacity: 0.45 },
  greenBtn: {
    backgroundColor: '#15803d',
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  greenBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  outlineBtn: {
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  outlineBtnText: { color: '#374151', fontWeight: '600', fontSize: 15 },

  /* Success */
  successBox: { alignItems: 'center', gap: 16, paddingTop: 40 },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: { fontSize: 22, fontWeight: '800', color: '#111827', textAlign: 'center' },
  successSub: { fontSize: 15, color: '#6b7280', textAlign: 'center', lineHeight: 22 },

  /* Misc */
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
  emptySub: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 22 },
});
