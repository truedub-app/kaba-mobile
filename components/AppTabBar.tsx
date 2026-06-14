import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuthStore } from '@/src/hooks/useAuth';
import { supabase } from '@/src/lib/supabase';

const KABA = '#15803d';
const INACTIVE = '#9ca3af';

const LEFT_TABS = [
  { name: 'Home',       ar: 'الرئيسية', href: '/',       iconOff: 'home-outline',  iconOn: 'home'  },
  { name: 'Categories', ar: 'الفئات',   href: '/browse', iconOff: 'grid-outline',  iconOn: 'grid'  },
] as const;

const MESSAGES_TAB = { name: 'Messages', ar: 'الرسائل', href: '/messages', iconOff: 'chatbubbles-outline', iconOn: 'chatbubbles' } as const;

// Buyers get their Profile; sellers get the Seller Dashboard instead
// (profile editing lives inside the dashboard for them).
const PROFILE_TAB   = { name: 'Profile',   ar: 'الملف الشخصي', href: '/profile',          iconOff: 'person-outline',     iconOn: 'person'     } as const;
const DASHBOARD_TAB = { name: 'Dashboard', ar: 'لوحة البائع',  href: '/seller-dashboard', iconOff: 'storefront-outline', iconOn: 'storefront' } as const;

/** Persistent bottom tab bar — lives in root layout, visible on every screen. */
export function AppTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const [unread, setUnread] = useState(0);
  const [orderNotif, setOrderNotif] = useState(0);

  // Total unread messages — shown as a badge on the Messages tab,
  // kept live via the conversations realtime stream.
  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) { setUnread(0); return; }

    const fetchUnread = async () => {
      const { data } = await supabase
        .from('conversations')
        .select('buyer_id, buyer_unread, seller_unread')
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);
      const total = (data ?? []).reduce(
        (sum, c) => sum + (c.buyer_id === userId ? (c.buyer_unread || 0) : (c.seller_unread || 0)),
        0
      );
      setUnread(total);
    };
    fetchUnread();

    const channel = supabase
      .channel(`tabbar-unread:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `buyer_id=eq.${userId}` }, fetchUnread)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `seller_id=eq.${userId}` }, fetchUnread)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // New order requests awaiting the seller's action → badge on the Dashboard tab.
  useEffect(() => {
    if (!userId) { setOrderNotif(0); return; }
    const fetchOrders = async () => {
      const { count } = await supabase
        .from('import_requests')
        .select('id', { count: 'exact', head: true })
        .eq('contractor_id', userId)
        .eq('status', 'deposit_held');
      setOrderNotif(count ?? 0);
    };
    fetchOrders();
    const channel = supabase
      .channel(`tabbar-orders:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'import_requests', filter: `contractor_id=eq.${userId}` }, fetchOrders)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // Hide on auth/onboarding screens, and in chats (keyboard needs the space)
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/welcome') ||
    pathname.startsWith('/chat')
  ) {
    return null;
  }

  const isSeller = profile?.role === 'seller' || profile?.role === 'admin';
  const rightTabs = [MESSAGES_TAB, isSeller ? DASHBOARD_TAB : PROFILE_TAB];

  const activeHref = (() => {
    if (pathname === '/') return '/';
    for (const tab of [...LEFT_TABS, ...rightTabs]) {
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

  const renderTab = (tab: { name: string; ar: string; href: string; iconOff: string; iconOn: string }) => {
    const active = tab.href === activeHref;
    const badgeCount = tab.href === '/messages'
      ? unread
      : tab.href === '/seller-dashboard'
      ? orderNotif
      : 0;
    const showBadge = badgeCount > 0;
    return (
      <TouchableOpacity
        key={tab.href}
        style={styles.tab}
        activeOpacity={0.7}
        onPress={() => router.navigate(tab.href as any)}
      >
        <View>
          <Ionicons
            name={(active ? tab.iconOn : tab.iconOff) as any}
            size={24}
            color={active ? KABA : INACTIVE}
          />
          {showBadge && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.labelAr, active && styles.labelActive]}>{tab.ar}</Text>
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

      {rightTabs.map(renderTab)}
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
  labelAr: {
    fontSize: 11,
    fontWeight: '700',
    color: INACTIVE,
  },
  label: {
    fontSize: 9.5,
    fontWeight: '600',
    color: INACTIVE,
  },
  labelActive: {
    color: KABA,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9.5,
    fontWeight: '800',
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
