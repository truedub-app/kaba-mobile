import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator, StyleSheet, Image,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuthStore } from '@/src/hooks/useAuth';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signInWithGoogle } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    setError(null);
    setLoading(true);
    const err = await signIn(email.trim().toLowerCase(), password);
    setLoading(false);
    if (err) setError(err);
    else router.replace('/(tabs)');
  };

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    const err = await signInWithGoogle();
    setGoogleLoading(false);
    if (err) setError(err);
    else router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoArea}>
            <Image source={require('../../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to your account</Text>
          </View>

          {/* Google button */}
          <TouchableOpacity
            style={styles.googleBtn}
            onPress={handleGoogle}
            disabled={googleLoading}
            activeOpacity={0.85}
          >
            {googleLoading ? (
              <ActivityIndicator size="small" color="#374151" />
            ) : (
              <>
                <GoogleIcon />
                <Text style={styles.googleText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={16} color="#9ca3af" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Password</Text>
              <TouchableOpacity>
                <Text style={styles.forgotLink}>Forgot password?</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={16} color="#9ca3af" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#9ca3af"
                secureTextEntry={!showPassword}
                autoComplete="password"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color="#9ca3af" />
              </TouchableOpacity>
            </View>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Sign In button */}
          <TouchableOpacity
            style={[styles.signInBtn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.signInText}>Sign In</Text>}
          </TouchableOpacity>

          {/* Sign up link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text style={styles.signUpLink}>Sign up</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function GoogleIcon() {
  return (
    <View style={{ width: 18, height: 18, marginRight: 8 }}>
      {/* Google G SVG paths rendered as colored squares approximate — use Svg if available */}
      <Text style={{ fontSize: 14, fontWeight: '700', color: '#4285F4', lineHeight: 18 }}>G</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  logoArea: { alignItems: 'center', paddingTop: 60, paddingBottom: 32 },
  logoText: { fontSize: 36, fontWeight: '900', color: '#166534', letterSpacing: -1 },
  logoImage: { width: 180, height: 64, marginBottom: 6 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', marginTop: 12 },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  googleText: { fontSize: 15, fontWeight: '500', color: '#374151' },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  dividerText: { fontSize: 12, color: '#9ca3af' },
  fieldGroup: { marginBottom: 16 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  label: { fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 6 },
  forgotLink: { fontSize: 12, color: '#15803d', fontWeight: '500' },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: '#111827', height: '100%' },
  eyeBtn: { padding: 4 },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: 16,
  },
  errorText: { color: '#dc2626', fontSize: 13 },
  signInBtn: {
    height: 52,
    backgroundColor: '#15803d',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.65 },
  signInText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { color: '#6b7280', fontSize: 14 },
  signUpLink: { color: '#15803d', fontSize: 14, fontWeight: '600' },
});
