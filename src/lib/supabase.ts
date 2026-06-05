import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const SUPABASE_STORAGE_URL = `${SUPABASE_URL}/storage/v1/object/public`;

// Storage adapter: SecureStore on native, localStorage on web.
// SecureStore max value is ~2KB; we chunk for large auth sessions.
const CHUNK_SIZE = 1800;

function makeNativeStorage() {
  // Lazily import SecureStore so web bundling never imports it
  const SecureStore = require('expo-secure-store');

  return {
    async getItem(key: string): Promise<string | null> {
      const countStr = await SecureStore.getItemAsync(`${key}.n`);
      if (!countStr) return SecureStore.getItemAsync(key);
      const n = parseInt(countStr, 10);
      const chunks = await Promise.all(
        Array.from({ length: n }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`))
      );
      return chunks.some((c) => c === null) ? null : chunks.join('');
    },

    async setItem(key: string, value: string): Promise<void> {
      if (value.length <= CHUNK_SIZE) {
        await Promise.all([
          SecureStore.setItemAsync(key, value),
          SecureStore.deleteItemAsync(`${key}.n`),
        ]);
        return;
      }
      const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, 'g'))!;
      await SecureStore.setItemAsync(`${key}.n`, String(chunks.length));
      await Promise.all(chunks.map((c: string, i: number) => SecureStore.setItemAsync(`${key}.${i}`, c)));
    },

    async removeItem(key: string): Promise<void> {
      const countStr = await SecureStore.getItemAsync(`${key}.n`);
      const ops: Promise<void>[] = [
        SecureStore.deleteItemAsync(key),
        SecureStore.deleteItemAsync(`${key}.n`),
      ];
      if (countStr) {
        const n = parseInt(countStr, 10);
        for (let i = 0; i < n; i++) ops.push(SecureStore.deleteItemAsync(`${key}.${i}`));
      }
      await Promise.all(ops);
    },
  };
}

const webStorage = {
  getItem: (key: string) => Promise.resolve(localStorage.getItem(key)),
  setItem: (key: string, value: string) => Promise.resolve(localStorage.setItem(key, value)),
  removeItem: (key: string) => Promise.resolve(localStorage.removeItem(key)),
};

const storage = Platform.OS === 'web' ? webStorage : makeNativeStorage();

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
