import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import Ionicons from '@expo/vector-icons/Ionicons';

export const WELCOME_SEEN_KEY = 'kaba_welcome_seen';

const FEATURES = [
  { icon: 'globe-outline',          ar: 'تسوق من أي بلد',  en: 'Shop from any country' },
  { icon: 'shield-checkmark-outline', ar: 'دفع آمن ومضمون', en: 'Safe & secure payment' },
  { icon: 'cube-outline',           ar: 'توصيل موثوق',     en: 'Trusted delivery' },
] as const;

export default function WelcomeScreen() {
  const router = useRouter();

  const markSeen = () => {
    SecureStore.setItemAsync(WELCOME_SEEN_KEY, '1').catch(() => {});
  };

  const goRegister = () => { markSeen(); router.replace('/(auth)/register'); };
  const goLogin    = () => { markSeen(); router.replace('/(auth)/login'); };
  const skip       = () => { markSeen(); router.replace('/(tabs)'); };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Skip */}
        <TouchableOpacity style={styles.skipBtn} onPress={skip} hitSlop={8}>
          <Text style={styles.skipText}>تخطي | Skip</Text>
        </TouchableOpacity>

        {/* Logo + tagline */}
        <View style={styles.logoArea}>
          <Text style={styles.logo}>KABA</Text>
          <Text style={styles.tagline}>اطلب من الخارج بأمان  |  Order from Abroad Safely</Text>
        </View>

        {/* Illustration */}
        <View style={styles.illustration}>
          <View style={styles.illustrationCircle}>
            <Text style={styles.illustrationEmoji}>🛍️</Text>
            <View style={styles.planeBadge}>
              <Ionicons name="airplane" size={22} color="#15803d" />
            </View>
            <View style={styles.flagBadge}>
              <Text style={{ fontSize: 20 }}>🇩🇿</Text>
            </View>
          </View>
        </View>

        {/* Features */}
        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f.en} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Ionicons name={f.icon as any} size={24} color="#15803d" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureAr}>{f.ar}</Text>
                <Text style={styles.featureEn}>{f.en}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* CTAs */}
        <TouchableOpacity style={styles.signupBtn} onPress={goRegister} activeOpacity={0.88}>
          <Text style={styles.signupText}>إنشاء حساب جديد  |  Sign Up</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.loginLink} onPress={goLogin} hitSlop={8}>
          <Text style={styles.loginAr}>لديك حساب؟ تسجيل الدخول</Text>
          <Text style={styles.loginEn}>Have an account? Login</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 28 },

  skipBtn: { alignSelf: 'flex-end', paddingVertical: 10 },
  skipText: { fontSize: 13, color: '#9ca3af', fontWeight: '600' },

  logoArea: { alignItems: 'center', marginTop: 8 },
  logo: { fontSize: 52, fontWeight: '900', color: '#166534', letterSpacing: 2 },
  tagline: { fontSize: 13.5, color: '#374151', fontWeight: '600', marginTop: 6, textAlign: 'center' },

  illustration: { alignItems: 'center', marginVertical: 30 },
  illustrationCircle: {
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center',
  },
  illustrationEmoji: { fontSize: 84 },
  planeBadge: {
    position: 'absolute', top: 8, right: 4,
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#dcfce7',
    transform: [{ rotate: '-20deg' }],
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  flagBadge: {
    position: 'absolute', bottom: 10, left: 6,
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#dcfce7',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },

  features: { gap: 14, marginBottom: 30 },
  featureRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1, borderColor: '#f3f4f6',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  featureIcon: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center',
  },
  featureAr: { fontSize: 16, fontWeight: '800', color: '#111827', textAlign: 'left' },
  featureEn: { fontSize: 13, color: '#6b7280', marginTop: 2 },

  signupBtn: {
    backgroundColor: '#166534', borderRadius: 16,
    paddingVertical: 17, alignItems: 'center',
    shadowColor: '#166534', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 5,
  },
  signupText: { color: '#fff', fontSize: 16.5, fontWeight: '800' },

  loginLink: { alignItems: 'center', marginTop: 18 },
  loginAr: { fontSize: 14.5, fontWeight: '700', color: '#111827' },
  loginEn: { fontSize: 13, color: '#15803d', fontWeight: '600', marginTop: 3 },
});
