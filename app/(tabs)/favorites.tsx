import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { ListingCard } from '@/components/ListingCard';
import { EmptyState } from '@/components/EmptyState';
import { useFavorites } from '@/src/hooks/useFavorites';
import { useAuthStore } from '@/src/hooks/useAuth';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_WIDTH = (SCREEN_WIDTH - 16 * 2 - 8) / 2;

export default function FavoritesScreen() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const { favorites, refreshing, refresh, toggle } = useFavorites(session?.user?.id);

  useEffect(() => {
    refresh();
  }, [session?.user?.id]);

  const renderItem = useCallback(
    ({ item }: any) => (
      <View style={{ width: COLUMN_WIDTH }}>
        <ListingCard
          listing={item}
          isFavorited
          onFavoriteToggle={async (id) => {
            await toggle(id);
          }}
        />
      </View>
    ),
    [toggle]
  );

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.header}>Saved</Text>
        <EmptyState
          emoji="🔐"
          title="Sign in to save listings"
          subtitle="Your saved items will appear here"
          actionLabel="Sign In"
          onAction={() => router.push('/(auth)/login')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.header}>Saved</Text>
      <FlashList
        data={favorites}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        estimatedItemSize={220}
        refreshing={refreshing}
        onRefresh={refresh}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !refreshing ? (
            <EmptyState
              emoji="❤️"
              title="No saved listings yet"
              subtitle="Tap the heart on any listing to save it"
              actionLabel="Browse Listings"
              onAction={() => router.push('/(tabs)')}
            />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
});
