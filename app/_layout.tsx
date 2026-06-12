import { useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SecureStore from 'expo-secure-store';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { initAuth, useAuthStore } from '@/src/hooks/useAuth';
import { AppTabBar } from '@/components/AppTabBar';
import { WELCOME_SEEN_KEY } from './welcome';

SplashScreen.preventAutoHideAsync();

export { ErrorBoundary } from 'expo-router';

export default function RootLayout() {
  const router = useRouter();
  const initialized = useAuthStore((s) => s.initialized);
  const gateChecked = useRef(false);

  useEffect(() => {
    const unsubscribe = initAuth();
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!initialized || gateChecked.current) return;
    gateChecked.current = true;

    // First launch + logged out → show the welcome/onboarding screen
    (async () => {
      try {
        const seen = await SecureStore.getItemAsync(WELCOME_SEEN_KEY);
        if (!seen && !useAuthStore.getState().session) {
          router.replace('/welcome');
        }
      } catch {}
      SplashScreen.hideAsync();
    })();
  }, [initialized]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack style={{ flex: 1 }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)"  options={{ headerShown: false }} />
        <Stack.Screen name="welcome"    options={{ headerShown: false }} />
        <Stack.Screen name="search"     options={{ headerShown: false }} />
        <Stack.Screen name="trips"      options={{ headerShown: false }} />
        <Stack.Screen name="abroad"     options={{ headerShown: false }} />
        <Stack.Screen name="orders"     options={{ headerShown: false }} />
        <Stack.Screen name="contractor" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <AppTabBar />
    </GestureHandlerRootView>
  );
}
