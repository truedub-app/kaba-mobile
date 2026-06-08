import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { initAuth, useAuthStore } from '@/src/hooks/useAuth';
import { AppTabBar } from '@/components/AppTabBar';

SplashScreen.preventAutoHideAsync();

export { ErrorBoundary } from 'expo-router';

export default function RootLayout() {
  const initialized = useAuthStore((s) => s.initialized);

  useEffect(() => {
    const unsubscribe = initAuth();
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (initialized) SplashScreen.hideAsync();
  }, [initialized]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack style={{ flex: 1 }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)"  options={{ headerShown: false }} />
        <Stack.Screen name="trips"   options={{ headerShown: false }} />
        <Stack.Screen name="abroad"  options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <AppTabBar />
    </GestureHandlerRootView>
  );
}
