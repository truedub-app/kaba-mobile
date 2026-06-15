import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/src/lib/supabase';
import type { Conversation, Message } from '@/src/types';

export function useConversations(userId: string | null | undefined) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setConversations([]);
      return;
    }
    setRefreshing(true);
    const { data } = await supabase
      .from('conversations')
      .select(`
        *,
        listing:listings(id, title, images, price),
        buyer:profiles!conversations_buyer_id_fkey(id, full_name, avatar_url),
        seller:profiles!conversations_seller_id_fkey(id, full_name, avatar_url)
      `)
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order('last_message_at', { ascending: false });

    setConversations((data ?? []) as Conversation[]);
    setRefreshing(false);
  }, [userId]);

  // Realtime: reload when any conversation changes for this user
  useEffect(() => {
    if (!userId) return;
    // Unique topic per mount — supabase.channel() returns an EXISTING channel if
    // the topic matches, and adding `.on()` to an already-subscribed channel
    // throws "cannot add postgres_changes callbacks after subscribe()". A unique
    // suffix guarantees a fresh channel every time.
    const channel = supabase
      .channel(`conversations:${userId}:${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `buyer_id=eq.${userId}`,
        },
        () => refresh()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `seller_id=eq.${userId}`,
        },
        () => refresh()
      )
      // Requires Realtime enabled on `conversations` in Supabase Dashboard → Database → Replication
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') refresh();
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  return { conversations, loading, refreshing, refresh };
}

export function useChat(conversationId: string, currentUserId: string | null | undefined) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Zero this user's unread counter on the conversation — that counter is
  // what the conversations list and tab-bar badge display.
  const clearUnread = useCallback(() => {
    if (!currentUserId) return;
    supabase.from('conversations').update({ buyer_unread: 0 })
      .eq('id', conversationId).eq('buyer_id', currentUserId).then(() => {});
    supabase.from('conversations').update({ seller_unread: 0 })
      .eq('id', conversationId).eq('seller_id', currentUserId).then(() => {});
  }, [conversationId, currentUserId]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('messages')
      .select(`*, sender:profiles!messages_sender_id_fkey(id, full_name, avatar_url)`)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    setMessages((data ?? []) as Message[]);
    setLoading(false);

    // Mark received messages as read
    if (currentUserId) {
      supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .neq('sender_id', currentUserId)
        .is('read_at', null)
        .then(() => {});
      clearUnread();
    }
  }, [conversationId, currentUserId, clearUnread]);

  // Realtime subscription
  useEffect(() => {
    load();

    const channel = supabase
      .channel(`messages:${conversationId}:${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          // Fetch with joined sender so the bubble renders correctly
          const { data } = await supabase
            .from('messages')
            .select(`*, sender:profiles!messages_sender_id_fkey(id, full_name, avatar_url)`)
            .eq('id', payload.new.id)
            .single();
          if (data) setMessages((prev) => [...prev, data as Message]);

          // Mark as read if the new message is from someone else
          if (currentUserId && payload.new.sender_id !== currentUserId) {
            supabase
              .from('messages')
              .update({ read_at: new Date().toISOString() })
              .eq('id', payload.new.id)
              .then(() => {});
            clearUnread(); // user is looking at the chat — keep counter at 0
          }
        }
      )
      // Requires Realtime enabled on `messages` in Supabase Dashboard → Database → Replication
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') load();
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId, load, clearUnread]);

  const sendMessage = useCallback(
    async (content: string, imageUrl?: string): Promise<boolean> => {
      if (!currentUserId) return false;
      setSending(true);
      const { error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        content: content || null,
        image_url: imageUrl ?? null,
      });
      setSending(false);
      return !error;
    },
    [conversationId, currentUserId]
  );

  return { messages, loading, sending, sendMessage };
}

export interface ProductRef {
  title: string;
  image?: string | null;
  price?: number | null;
  url?: string | null;       // external product (abroad)
  listingId?: string | null; // local listing → /listing/[id]
}

/** Drop a product card into the chat so both parties can tap to open it.
 *  Skips if the most recent message is already the same product (no spam). */
export async function sendProductCard(conversationId: string, senderId: string, p: ProductRef) {
  const { data: last } = await supabase
    .from('messages')
    .select('product_listing_id, product_url')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last && ((p.listingId && last.product_listing_id === p.listingId) ||
               (p.url && last.product_url === p.url))) {
    return;
  }
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: senderId,
    content: p.title,
    product_title: p.title,
    product_image: p.image ?? null,
    product_price: p.price ?? null,
    product_url: p.url ?? null,
    product_listing_id: p.listingId ?? null,
  });
}

export async function getOrCreateConversation(
  listingId: string | null,
  buyerId: string,
  sellerId: string
): Promise<string | null> {
  if (!buyerId || !sellerId || buyerId === sellerId) return null;

  // One conversation per pair of people — regardless of which listing/product
  // sparked it or who messaged first. Match an existing row in EITHER direction
  // and ignore listing_id so the same seller isn't duplicated across products.
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .or(
      `and(buyer_id.eq.${buyerId},seller_id.eq.${sellerId}),` +
        `and(buyer_id.eq.${sellerId},seller_id.eq.${buyerId})`
    )
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    // Surface the product they just contacted about in the chat.
    if (listingId) {
      await supabase.from('conversations').update({ listing_id: listingId }).eq('id', existing.id);
    }
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from('conversations')
    .insert({ buyer_id: buyerId, seller_id: sellerId, ...(listingId ? { listing_id: listingId } : {}) })
    .select('id')
    .single();

  return error ? null : created.id;
}
