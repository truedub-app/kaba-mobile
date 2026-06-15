import { create } from 'zustand';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/src/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '@/src/types';

WebBrowser.maybeCompleteAuthSession();

interface AuthStore {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, fullName: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<string | null>;
  refreshProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  session: null,
  profile: null,
  loading: true,
  initialized: false,

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  },

  signUp: async (email, password, fullName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (!error && data.user) {
      // Update profile with full name
      await supabase.from('profiles').update({ full_name: fullName }).eq('id', data.user.id);
    }
    return error?.message ?? null;
  },

  signInWithGoogle: async () => {
    // ── Web (Expo web / browser) ─────────────────────────────────────────────
    // Use a plain browser redirect. After Google → Supabase → redirect back,
    // the Supabase client auto-detects ?code= (detectSessionInUrl: true on web)
    // and fires SIGNED_IN via onAuthStateChange. No popup needed.
    if (Platform.OS === 'web') {
      const redirectTo = typeof window !== 'undefined' ? window.location.origin : '';
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      return error?.message ?? null;
    }

    // ── Native (iOS / Android) ───────────────────────────────────────────────
    // Open an in-app browser, intercept the redirect, exchange the code manually.
    // Must include a path: Supabase's "kaba://**" allow-list wildcard does not
    // match the bare "kaba://" URL, causing a fallback redirect to the Site URL.
    const redirectTo = Linking.createURL('auth/callback');

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });

    if (error || !data?.url) return error?.message ?? 'Failed to start Google sign-in';

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    if (result.type === 'success') {
      // exchangeCodeForSession expects the bare auth code, not the full URL —
      // passing the URL makes Supabase fail with "no valid flow state found"
      const code = result.url.match(/[?&]code=([^&#]+)/)?.[1];
      if (!code) return 'Google sign-in failed (no auth code in redirect)';
      const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
      return sessionError?.message ?? null;
    }
    if (result.type === 'cancel') return null;
    return 'Google sign-in failed';
  },

  signOut: async () => {
    // Clear this device's push token from the profile so the next account that
    // logs in on this phone doesn't inherit it (which caused senders to receive
    // pushes meant for the other party when testing multiple accounts).
    const uid = get().session?.user?.id;
    if (uid) {
      await supabase.from('profiles').update({ expo_push_token: null }).eq('id', uid).then(() => {});
    }
    await supabase.auth.signOut();
    set({ session: null, profile: null });
  },

  updateProfile: async (updates) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 'Not authenticated';
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();
    if (data) set({ profile: data as Profile });
    return error?.message ?? null;
  },

  refreshProfile: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (data) set({ profile: data as Profile });
  },
}));

async function fetchAndSetProfile(userId: string) {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (data) useAuthStore.setState({ profile: data as Profile });
}

export function initAuth(): () => void {
  supabase.auth.getSession().then(({ data: { session } }) => {
    useAuthStore.setState({ session, loading: false, initialized: true });
    if (session?.user) fetchAndSetProfile(session.user.id);
  });

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.setState({ session });
    if (session?.user) {
      fetchAndSetProfile(session.user.id);
    } else {
      useAuthStore.setState({ profile: null });
    }
  });

  return () => data.subscription.unsubscribe();
}
