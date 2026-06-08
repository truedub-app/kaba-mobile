import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMyTrips, cancelTrip } from '@/src/hooks/useTrips';
import { useAuthStore } from '@/src/hooks/useAuth';
import type { TravelTrip } from '@/src/types';

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  active:    { bg: '#dcfce7', text: '#15803d' },
  completed: { bg: '#f3f4f6', text: '#6b7280' },
  cancelled: { bg: '#fee2e2', text: '#b91c1c' },
};

function TripCard({ trip, onCancel }: { trip: TravelTrip; onCancel: () => void }) {
  const sc = STATUS_COLOR[trip.status] ?? { bg: '#f3f4f6', text: '#6b7280' };
  // Buyer ETA preview
  const deliveryDate = new Date(
    new Date(`${trip.return_date}T00:00:00`).getTime() + 3 * 86_400_000
  ).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.planeIcon}>
          <Ionicons name="airplane-outline" size={20} color="#15803d" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>
            {trip.source_country}
            {trip.source_city ? ` — ${trip.source_city}` : ''}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusText, { color: sc.text }]}>
              {trip.status.charAt(0).toUpperCase() + trip.status.slice(1)}
            </Text>
          </View>
        </View>
        {trip.status === 'active' && (
          <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
            <Ionicons name="close-circle-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.metaRow}>
        <View style={styles.meta}>
          <Ionicons name="calendar-outline" size={12} color="#9ca3af" />
          <Text style={styles.metaText}>Departs: <Text style={styles.metaValue}>{trip.departure_date}</Text></Text>
        </View>
        <View style={styles.meta}>
          <Ionicons name="calendar-outline" size={12} color="#9ca3af" />
          <Text style={styles.metaText}>Returns: <Text style={styles.metaValue}>{trip.return_date}</Text></Text>
        </View>
        {trip.max_weight_kg != null && (
          <View style={styles.meta}>
            <Ionicons name="scale-outline" size={12} color="#9ca3af" />
            <Text style={styles.metaText}>Max: <Text style={styles.metaValue}>{trip.max_weight_kg} kg</Text></Text>
          </View>
        )}
      </View>

      {trip.status === 'active' && (
        <View style={styles.etaPreview}>
          <Ionicons name="time-outline" size={12} color="#15803d" />
          <Text style={styles.etaText}>Buyer ETA: <Text style={{ fontWeight: '700' }}>{deliveryDate}</Text></Text>
        </View>
      )}

      {trip.notes ? (
        <Text style={styles.notes} numberOfLines={2}>{trip.notes}</Text>
      ) : null}
    </View>
  );
}

export default function TripsScreen() {
  const router  = useRouter();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const { trips, loading, refresh } = useMyTrips();

  useEffect(() => { refresh(); }, []);

  const handleCancel = (trip: TravelTrip) => {
    Alert.alert(
      'Cancel Trip',
      `Cancel your trip to ${trip.source_country}? Items linked to this trip will lose their ETA.`,
      [
        { text: 'Keep Trip', style: 'cancel' },
        {
          text: 'Cancel Trip',
          style: 'destructive',
          onPress: async () => {
            const err = await cancelTrip(trip.id);
            if (err) Alert.alert('Error', err);
            else refresh();
          },
        },
      ]
    );
  };

  if (!session) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Sign in to manage trips</Text>
          <TouchableOpacity style={styles.greenBtn} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.greenBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isEligible = profile?.role === 'seller' || profile?.role === 'admin';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Trips</Text>
        {isEligible && (
          <TouchableOpacity
            style={styles.newBtn}
            onPress={() => router.push('/trips/create')}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color="#15803d" style={{ marginTop: 40 }} />
      ) : !isEligible ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Sellers Only</Text>
          <Text style={styles.emptySubtitle}>Register as a seller to manage trips.</Text>
          <TouchableOpacity style={styles.greenBtn} onPress={() => router.push('/seller/apply')}>
            <Text style={styles.greenBtnText}>Apply to Sell</Text>
          </TouchableOpacity>
        </View>
      ) : trips.length === 0 ? (
        <ScrollView contentContainerStyle={styles.centered}>
          <Ionicons name="airplane-outline" size={48} color="#d1d5db" />
          <Text style={styles.emptyTitle}>No trips yet</Text>
          <Text style={styles.emptySubtitle}>
            Register an upcoming trip so buyers can see when their items arrive.
          </Text>
          <TouchableOpacity
            style={styles.greenBtn}
            onPress={() => router.push('/trips/create')}
          >
            <Text style={styles.greenBtnText}>Register a Trip</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push('/abroad/post')}
          >
            <Text style={styles.secondaryBtnText}>Post an Abroad Item</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12 }}
          showsVerticalScrollIndicator={false}
        >
          {trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} onCancel={() => handleCancel(trip)} />
          ))}
          <TouchableOpacity
            style={[styles.greenBtn, { marginTop: 4 }]}
            onPress={() => router.push('/abroad/post')}
          >
            <Text style={styles.greenBtnText}>+ Post an Abroad Item</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#111827' },
  newBtn: {
    backgroundColor: '#15803d', borderRadius: 10,
    padding: 6, alignItems: 'center', justifyContent: 'center',
  },

  card: {
    backgroundColor: '#fff', borderRadius: 16, borderWidth: 1,
    borderColor: '#e5e7eb', padding: 14,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  planeIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#f0fdf4',
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  statusText: { fontSize: 11, fontWeight: '600' },
  cancelBtn: { padding: 4 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: '#6b7280' },
  metaValue: { fontWeight: '600', color: '#374151' },

  etaPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#f0fdf4', borderRadius: 8, padding: 8, marginBottom: 6,
  },
  etaText: { fontSize: 12, color: '#15803d' },
  notes: { fontSize: 12, color: '#6b7280', fontStyle: 'italic', lineHeight: 16 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginTop: 12, marginBottom: 6, textAlign: 'center' },
  emptySubtitle: { fontSize: 13, color: '#9ca3af', textAlign: 'center', lineHeight: 18, marginBottom: 20 },
  greenBtn: {
    backgroundColor: '#15803d', borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12, alignItems: 'center',
  },
  greenBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  secondaryBtn: {
    marginTop: 10, borderWidth: 1.5, borderColor: '#15803d',
    borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, alignItems: 'center',
  },
  secondaryBtnText: { color: '#15803d', fontWeight: '600', fontSize: 14 },
});
