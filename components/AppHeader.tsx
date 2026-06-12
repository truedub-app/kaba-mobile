import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from './Avatar';
import { useAuthStore } from '@/src/hooks/useAuth';

const LOGO = require('@/assets/logo.png');

interface Props {
  /** Extra element on the left (e.g. back button). Replaces the logo when set. */
  leftSlot?: React.ReactNode;
}

export function AppHeader({ leftSlot }: Props = {}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <>
      <View style={styles.header}>
        {leftSlot ?? (
          <Image source={LOGO} style={styles.logo} contentFit="contain" />
        )}
        <TouchableOpacity
          onPress={() => setMenuVisible(true)}
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        >
          <Ionicons name="menu" size={26} color="#111827" />
        </TouchableOpacity>
      </View>

      {/* ── Hamburger Side Menu ── */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <View style={styles.menuOverlay}>
          <TouchableOpacity
            style={styles.menuBackdrop}
            activeOpacity={1}
            onPress={() => setMenuVisible(false)}
          />
          <View style={[styles.menuPanel, { paddingTop: insets.top }]}>
            {/* Close */}
            <View style={styles.menuTopRow}>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setMenuVisible(false)}
              >
                <Ionicons name="close" size={20} color="#111827" />
              </TouchableOpacity>
            </View>

            {/* User info */}
            {session && profile && (
              <View style={styles.menuUser}>
                <Avatar
                  name={profile.full_name}
                  avatarUrl={profile.avatar_url}
                  size={52}
                />
                <View style={styles.menuUserInfo}>
                  <Text style={styles.menuUserName} numberOfLines={1}>
                    {profile.full_name ?? 'User'}
                  </Text>
                  <Text style={styles.menuUserRole}>
                    {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
                  </Text>
                </View>
              </View>
            )}

            {/* Items */}
            <View style={styles.menuItems}>
              {/* Sellers manage their profile from the Seller Dashboard */}
              {profile?.role !== 'seller' && profile?.role !== 'admin' && (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => { setMenuVisible(false); router.push('/(tabs)/profile'); }}
                >
                  <Text style={styles.menuItemText}>My Profile</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => { setMenuVisible(false); router.push('/(tabs)/favorites'); }}
              >
                <Text style={styles.menuItemText}>Saved Listings</Text>
              </TouchableOpacity>
              {/* Seller-aware menu item */}
              {profile?.role === 'seller' || profile?.role === 'admin' ? (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => { setMenuVisible(false); router.push('/(tabs)/seller-dashboard'); }}
                >
                  <Text style={styles.menuItemText}>Seller Dashboard</Text>
                </TouchableOpacity>
              ) : profile?.seller_status === 'pending' ? (
                <View style={styles.menuItem}>
                  <Text style={[styles.menuItemText, { color: '#f59e0b' }]}>
                    Application Pending…
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => { setMenuVisible(false); router.push('/seller/apply'); }}
                >
                  <Text style={[styles.menuItemText, { color: '#15803d', fontWeight: '600' }]}>
                    Become a Seller
                  </Text>
                </TouchableOpacity>
              )}
              {profile?.role === 'admin' && (
                <TouchableOpacity style={styles.menuItem}>
                  <Text style={styles.menuItemText}>Admin Dashboard</Text>
                </TouchableOpacity>
              )}
              {session ? (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={async () => { setMenuVisible(false); await signOut(); }}
                >
                  <Text style={[styles.menuItemText, { color: '#ef4444' }]}>Sign Out</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => { setMenuVisible(false); router.push('/(auth)/login'); }}
                >
                  <Text style={[styles.menuItemText, { color: '#15803d' }]}>Sign In</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  logo: {
    width: 88,
    height: 34,
  },

  /* ── Menu ── */
  menuOverlay: { flex: 1, flexDirection: 'row' },
  menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  menuPanel: {
    width: '83%',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: -4, height: 0 },
    elevation: 12,
  },
  menuTopRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuUser: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
  },
  menuUserInfo: { flex: 1 },
  menuUserName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  menuUserRole: { fontSize: 12, color: '#6b7280', marginTop: 2, fontWeight: '500' },
  menuItems: { paddingTop: 4 },
  menuItem: { paddingHorizontal: 20, paddingVertical: 16 },
  menuItemText: { fontSize: 15, color: '#111827', fontWeight: '400' },
});
