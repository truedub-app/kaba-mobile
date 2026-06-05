import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

const KABA = '#15803d';
const INACTIVE = '#9ca3af';

const TABS = [
  { name: 'Home',      href: '/',          iconOff: 'home-outline',          iconOn: 'home' },
  { name: 'Browse',    href: '/browse',     iconOff: 'grid-outline',          iconOn: 'grid' },
  { name: 'Favorites', href: '/favorites',  iconOff: 'heart-outline',         iconOn: 'heart' },
  { name: 'Messages',  href: '/messages',   iconOff: 'chatbubbles-outline',   iconOn: 'chatbubbles' },
  { name: 'Profile',   href: '/profile',    iconOff: 'person-outline',        iconOn: 'person' },
] as const;

/** Persistent bottom tab bar — rendered at the root layout so it survives
 *  navigation to listing, chat, user-profile and other detail screens. */
export function AppTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Hide on auth screens
  if (pathname.startsWith('/login') || pathname.startsWith('/register')) {
    return null;
  }

  const activeHref = (() => {
    if (pathname === '/') return '/';
    for (const tab of TABS) {
      if (tab.href !== '/' && pathname.startsWith(tab.href)) return tab.href;
    }
    return null;
  })();

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom || 8 }]}>
      {TABS.map((tab) => {
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
            <Text style={[styles.label, active && styles.labelActive]}>
              {tab.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
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
});
