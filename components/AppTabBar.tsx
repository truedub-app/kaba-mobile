import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuthStore } from '@/src/hooks/useAuth';

const KABA = '#15803d';
const INACTIVE = '#9ca3af';

const LEFT_TABS = [
  { name: 'Home',   href: '/',       iconOff: 'home-outline',  iconOn: 'home'  },
  { name: 'Browse', href: '/browse', iconOff: 'grid-outline',  iconOn: 'grid'  },
] as const;

const RIGHT_TABS = [
  { name: 'Messages', href: '/messages', iconOff: 'chatbubbles-outline', iconOn: 'chatbubbles' },
  { name: 'Profile',  href: '/profile',  iconOff: 'person-outline',      iconOn: 'person'      },
] as const;

/** Persistent bottom tab bar — lives in root layout, visible on every screen. */
export function AppTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);

  // Hide on auth screens
  if (pathname.startsWith('/login') || pathname.startsWith('/register')) {
    return null;
  }

  const activeHref = (() => {
    if (pathname === '/') return '/';
    for (const tab of [...LEFT_TABS, ...RIGHT_TABS]) {
      if (tab.href !== '/' && pathname.startsWith(tab.href)) return tab.href;
    }
    return null;
  })();

  const handleAdd = () => {
    if (!session) {
      router.push('/(auth)/login');
      return;
    }
    if (profile?.role === 'seller' || profile?.role === 'admin') {
      router.push('/listing/create');
    } else if (profile?.seller_status === 'pending') {
      Alert.alert(
        'Application Pending',
        'Your seller application is under review. We\'ll notify you once approved.'
      );
    } else {
      router.push('/seller/apply');
    }
  };

  const renderTab = (tab: { name: string; href: string; iconOff: string; iconOn: string }) => {
    const active = tab.href === activeHref;
    return (
      <TouchableOpacity
        key={tab.href}
        style={styles.tab}
        activeOpacity={0.7}
        onPress={() => router.navigate(tab.href as any)}
      >
        <Ionicons
          name={(active ? tab.iconOn : tab.iconOff) as any}
          size={24}
          color={active ? KABA : INACTIVE}
        />
        <Text style={[styles.label, active && styles.labelActive]}>{tab.name}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom || 8 }]}>
      {LEFT_TABS.map(renderTab)}

      {/* Center + button */}
      <TouchableOpacity style={styles.addWrap} onPress={handleAdd} activeOpacity={0.85}>
        <View style={styles.addBtn}>
          <Ionicons name="add" size={30} color="#fff" />
        </View>
      </TouchableOpacity>

      {RIGHT_TABS.map(renderTab)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0fdf4',
    paddingTop: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingBottom: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: INACTIVE,
  },
  labelActive: {
    color: KABA,
  },
  // Center add button
  addWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 6,
  },
  addBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: KABA,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowColor: KABA,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
});
