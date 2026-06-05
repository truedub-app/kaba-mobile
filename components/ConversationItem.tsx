import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar } from './Avatar';
import { formatMessageTime, getListingImageUrl } from '@/src/lib/utils';
import type { Conversation } from '@/src/types';

interface Props {
  conversation: Conversation;
  currentUserId: string;
}

export function ConversationItem({ conversation, currentUserId }: Props) {
  const router = useRouter();

  const isBuyer = conversation.buyer_id === currentUserId;
  const other = isBuyer ? conversation.seller : conversation.buyer;
  const unread = isBuyer ? conversation.buyer_unread : conversation.seller_unread;

  return (
    <TouchableOpacity
      style={styles.item}
      onPress={() => router.push(`/chat/${conversation.id}`)}
      activeOpacity={0.7}
    >
      <Avatar name={other?.full_name} avatarUrl={other?.avatar_url} size={50} />

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>
            {other?.full_name ?? 'User'}
          </Text>
          <Text style={styles.time}>
            {formatMessageTime(conversation.last_message_at)}
          </Text>
        </View>

        {conversation.listing && (
          <Text style={styles.listing} numberOfLines={1}>
            re: {conversation.listing.title}
          </Text>
        )}

        <View style={styles.bottomRow}>
          <Text style={[styles.preview, unread > 0 && styles.previewUnread]} numberOfLines={1}>
            {conversation.last_message ?? 'No messages yet'}
          </Text>
          {unread > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  content: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  time: {
    fontSize: 11,
    color: '#9ca3af',
    marginLeft: 8,
  },
  listing: {
    fontSize: 11,
    color: '#15803d',
    marginTop: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  preview: {
    fontSize: 13,
    color: '#6b7280',
    flex: 1,
  },
  previewUnread: {
    fontWeight: '600',
    color: '#111827',
  },
  badge: {
    backgroundColor: '#15803d',
    borderRadius: 999,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginLeft: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
