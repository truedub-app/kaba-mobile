import { useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { initAuth, useAuthStore } from '@/src/hooks/useAuth';
import { registerForPush } from '@/src/lib/push';
import { AppTabBar } from '@/components/AppTabBar';
import { WELCOME_SEEN_KEY } from './welcome';

SplashScreen.preventAutoHideAsync();

export { ErrorBoundary } from 'expo-router';

export default function RootLayout() {
  const router = useRouter();
  const initialized = useAuthStore((s) => s.initialized);
  const session = useAuthStore((s) => s.session);
  const gateChecked = useRef(false);
  const pushedFor = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth();
    return unsubscribe;
  }, []);

  // Register for push notifications once per signed-in user
  useEffect(() => {
    const uid = session?.user?.id;
    if (uid && pushedFor.current !== uid) {
      pushedFor.current = uid;
      registerForPush(uid);
    }
    if (!uid) pushedFor.current = null;
  }, [session?.user?.id]);

  // Deep-link a notification tap to the right screen
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = resp.notification.request.content.data as Record<string, unknown>;
      if (data?.type === 'message' && data.conversation_id) {
        router.push(`/chat/${data.conversation_id}` as any);
      } else if (data?.type === 'order_request') {
        router.push('/contractor/orders');
      } else if (data?.type === 'order_update' && data.id) {
        router.push(`/orders/${data.id}` as any);
      }
    });
    return () => sub.remove();
  }, [router]);

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
      {/* Global: no native headers (screens render their own) — fixes the
          double back-button on trips/abroad/orders/contractor screens, whose
          directory-level options never applied. Full-screen gesture lets
          users swipe back from anywhere, not just the screen edge. */}
      <Stack
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      />
      <AppTabBar />
    </GestureHandlerRootView>
  );
}
