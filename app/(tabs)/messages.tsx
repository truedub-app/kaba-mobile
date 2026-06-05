import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppHeader } from '@/components/AppHeader';
import { SearchBar } from '@/components/SearchBar';
import { Avatar } from '@/components/Avatar';
import { EmptyState } from '@/components/EmptyState';
import { useConversations } from '@/src/hooks/useMessages';
import { useAuthStore } from '@/src/hooks/useAuth';
import { supabase } from '@/src/lib/supabase';
import { formatMessageTime } from '@/src/lib/utils';
import type { Conversation } from '@/src/types';

interface ContextMenu {
  conversation: Conversation;
  otherUserId: string;
}

export default function MessagesScreen() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const { conversations, refreshing, refresh } = useConversations(session?.user?.id);
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { refresh(); }, [session?.user?.id]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => {
      const isBuyer = c.buyer_id === session?.user?.id;
      const other = isBuyer ? c.seller : c.buyer;
      return (
        other?.full_name?.toLowerCase().includes(q) ||
        c.listing?.title?.toLowerCase().includes(q) ||
        (c.last_message ?? '').toLowerCase().includes(q)
      );
    });
  }, [conversations, searchQuery, session?.user?.id]);

  const handleDelete = useCallback(async () => {
    if (!contextMenu) return;
    setDeleting(true);
    await supabase.from('conversations').delete().eq('id', contextMenu.conversation.id);
    setDeleting(false);
    setContextMenu(null);
    refresh();
  }, [contextMenu, refresh]);

  const handleViewProfile = useCallback(() => {
    if (!contextMenu) return;
    const id = contextMenu.otherUserId;
    setContextMenu(null);
    router.push(`/user/${id}`);
  }, [contextMenu, router]);

  const renderItem = useCallback(({ item }: { item: Conversation }) => {
    const isBuyer = item.buyer_id === session?.user?.id;
    const other = isBuyer ? item.seller : item.buyer;
    const unread = isBuyer ? item.buyer_unread : item.seller_unread;

    return (
      <TouchableOpacity
        style={styles.convItem}
        onPress={() => router.push(`/chat/${item.id}`)}
        onLongPress={() => setContextMenu({ conversation: item, otherUserId: other?.id ?? '' })}
        delayLongPress={400}
        activeOpacity={0.7}
      >
        <Avatar name={other?.full_name} avatarUrl={other?.avatar_url} size={50} />
        <View style={styles.convContent}>
          <View style={styles.convTop}>
            <Text style={styles.convName} numberOfLines={1}>{other?.full_name ?? 'User'}</Text>
            <Text style={styles.convTime}>{formatMessageTime(item.last_message_at)}</Text>
          </View>
          {item.listing && (
            <Text style={styles.convListing} numberOfLines={1}>re: {item.listing.title}</Text>
          )}
          <View style={styles.convBottom}>
            <Text
              style={[styles.convPreview, unread > 0 && styles.convPreviewBold]}
              numberOfLines={1}
            >
              {item.last_message ?? 'No messages yet'}
            </Text>
            {unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [session?.user?.id]);

  if (!session) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <AppHeader />
        <SearchBar
          value=""
          onChangeText={() => {}}
          onSubmit={() => router.push('/(tabs)/browse')}
          placeholder="Search items, categories or locations..."
        />
        <Text style={styles.pageTitle}>Messages</Text>
        <EmptyState
          emoji="💬"
          title="Sign in to view messages"
          subtitle="Chat with sellers and buyers here"
          actionLabel="Sign In"
          onAction={() => router.push('/(auth)/login')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />
      <SearchBar
        value=""
        onChangeText={() => {}}
        onSubmit={() => router.push('/(tabs)/browse')}
        placeholder="Search items, categories or locations..."
      />

      <Text style={styles.pageTitle}>Messages</Text>

      {/* Search conversations */}
      <View style={styles.convSearchWrap}>
        <Ionicons name="search-outline" size={16} color="#9ca3af" />
        <TextInput
          style={styles.convSearchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search conversations..."
          placeholderTextColor="#9ca3af"
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      <FlashList
        data={filtered}
        keyExtractor={(item) => item.id}
        estimatedItemSize={80}
        refreshing={refreshing}
        onRefresh={refresh}
        renderItem={renderItem}
        ListEmptyComponent={
          !refreshing ? (
            <EmptyState
              emoji="💬"
              title="No conversations yet"
              subtitle="Message a seller from any listing to start chatting"
              actionLabel="Browse Listings"
              onAction={() => router.push('/(tabs)')}
            />
          ) : null
        }
      />

      {/* ── Context menu popup ── */}
      <Modal
        visible={!!contextMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setContextMenu(null)}
      >
        <TouchableOpacity
          style={styles.contextBackdrop}
          activeOpacity={1}
          onPress={() => setContextMenu(null)}
        />
        <View style={styles.contextPopup}>
          <TouchableOpacity style={styles.contextItem} onPress={handleViewProfile}>
            <Text style={styles.contextItemText}>View profile</Text>
          </TouchableOpacity>
          <View style={styles.contextDivider} />
          <TouchableOpacity style={styles.contextItem} onPress={() => {
            Alert.alert(
              'Delete conversation',
              'This will permanently delete the conversation. Continue?',
              [
                { text: 'Cancel', style: 'cancel', onPress: () => setContextMenu(null) },
                { text: 'Delete', style: 'destructive', onPress: handleDelete },
              ]
            );
          }}>
            {deleting ? (
              <ActivityIndicator size="small" color="#ef4444" />
            ) : (
              <View style={styles.contextDeleteRow}>
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
                <Text style={[styles.contextItemText, styles.contextDeleteText]}>
                  Delete conversation
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },

  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },

  convSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  convSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    height: '100%',
  },

  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  convContent: { flex: 1 },
  convTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  convName: { fontSize: 15, fontWeight: '600', color: '#111827', flex: 1 },
  convTime: { fontSize: 11, color: '#9ca3af', marginLeft: 8 },
  convListing: { fontSize: 11, color: '#15803d', marginTop: 1 },
  convBottom: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  convPreview: { fontSize: 13, color: '#6b7280', flex: 1 },
  convPreviewBold: { fontWeight: '600', color: '#111827' },
  unreadBadge: {
    backgroundColor: '#15803d',
    borderRadius: 999,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginLeft: 6,
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  /* Context menu */
  contextBackdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  contextPopup: {
    position: 'absolute',
    bottom: 120,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    minWidth: 200,
    overflow: 'hidden',
  },
  contextItem: { paddingHorizontal: 18, paddingVertical: 16 },
  contextItemText: { fontSize: 15, color: '#111827' },
  contextDivider: { height: 1, backgroundColor: '#f3f4f6' },
  contextDeleteRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  contextDeleteText: { color: '#ef4444' },
});
