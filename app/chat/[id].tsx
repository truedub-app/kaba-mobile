import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MessageBubble } from '@/components/MessageBubble';
import { Avatar } from '@/components/Avatar';
import { useChat } from '@/src/hooks/useMessages';
import { useAuthStore } from '@/src/hooks/useAuth';
import { supabase } from '@/src/lib/supabase';

export default function ChatScreen() {
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useAuthStore((s) => s.session);
  const currentUserId = session?.user?.id ?? null;

  const { messages, loading, sending, sendMessage } = useChat(conversationId, currentUserId);
  const [text, setText] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const [conversation, setConversation] = useState<any>(null);

  const other = conversation
    ? (conversation.buyer_id === currentUserId ? conversation.seller : conversation.buyer)
    : null;

  useEffect(() => {
    supabase
      .from('conversations')
      .select(`
        *,
        listing:listings(id, title),
        buyer:profiles!conversations_buyer_id_fkey(id, full_name, avatar_url),
        seller:profiles!conversations_seller_id_fkey(id, full_name, avatar_url)
      `)
      .eq('id', conversationId)
      .single()
      .then(({ data }) => { if (data) setConversation(data); });
  }, [conversationId, currentUserId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSend = async () => {
    const content = text.trim();
    if (!content) return;
    setText('');
    const ok = await sendMessage(content);
    if (!ok) {
      setText(content);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };

  const handleImagePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingImage(true);
    try {
      const asset = result.assets[0];
      const rawExt = (asset.uri.split('.').pop() ?? 'jpg').toLowerCase();
      const ext = rawExt === 'jpeg' ? 'jpg' : rawExt.replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = `${conversationId}/${Date.now()}.${ext}`;

      // RN: fetch(uri).blob() often yields a 0-byte blob — use arrayBuffer (same
      // fix as the receipt upload).
      const response = await fetch(asset.uri);
      if (!response.ok) throw new Error(`Failed to read image: ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();

      const { data, error } = await supabase.storage
        .from('chat-images')
        .upload(path, arrayBuffer, { contentType: ext === 'png' ? 'image/png' : 'image/jpeg', upsert: false });

      if (error) {
        Alert.alert('Upload failed', error.message);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('chat-images')
        .getPublicUrl(data.path);

      await sendMessage('', urlData.publicUrl);
    } finally {
      setUploadingImage(false);
    }
  };

  if (!session) {
    return (
      <View style={styles.center}>
        <Text style={styles.authRequired}>Please sign in to chat</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Custom header with a back button (works from any screen) */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerName} numberOfLines={1}>{other?.full_name ?? 'Chat'}</Text>
        {other
          ? <Avatar name={other.full_name} avatarUrl={other.avatar_url} size={34} />
          : <View style={{ width: 34 }} />}
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top + 52}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#15803d" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => (
              <MessageBubble message={item} isMine={item.sender_id === currentUserId} />
            )}
            contentContainerStyle={styles.messageList}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Text style={styles.emptyChatText}>Start the conversation!</Text>
              </View>
            }
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {/* Input bar */}
        <View style={[styles.inputBar, { paddingBottom: (insets.bottom || 8) }]}>
          <TouchableOpacity
            style={styles.attachBtn}
            onPress={handleImagePick}
            disabled={uploadingImage || sending}
          >
            {uploadingImage ? (
              <ActivityIndicator size="small" color="#15803d" />
            ) : (
              <Ionicons name="image-outline" size={22} color="#6b7280" />
            )}
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Type a message..."
            placeholderTextColor="#9ca3af"
            multiline
            maxLength={1000}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />

          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
            activeOpacity={0.7}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: '#fff',
  },
  backBtn: { padding: 2 },
  headerName: { flex: 1, fontSize: 16, fontWeight: '800', color: '#111827' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  authRequired: { color: '#6b7280', fontSize: 15 },
  listingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f0fdf4',
    borderBottomWidth: 1,
    borderBottomColor: '#bbf7d0',
  },
  listingBannerText: { fontSize: 12, color: '#15803d', fontWeight: '500', flex: 1 },
  messageList: { paddingVertical: 12 },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyChatText: { color: '#9ca3af', fontSize: 14 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#fff',
  },
  attachBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 15,
    color: '#111827',
    maxHeight: 120,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: '#15803d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#d1d5db' },
});
