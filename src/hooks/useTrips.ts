import { useState, useCallback } from 'react';
import { supabase } from '@/src/lib/supabase';
import { useAuthStore } from '@/src/hooks/useAuth';
import type { TravelTrip, TravelTripStatus } from '@/src/types';

export function useMyTrips() {
  const session = useAuthStore((s) => s.session);
  const [trips, setTrips]     = useState<TravelTrip[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session?.user) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('travel_trips')
      .select('*')
      .eq('user_id', session.user.id)
      .order('departure_date', { ascending: false });
    setTrips((data ?? []) as TravelTrip[]);
    setLoading(false);
  }, [session?.user?.id]);

  return { trips, loading, refresh: load };
}

export interface CreateTripPayload {
  source_country: string;
  source_city?: string;
  departure_date: string;
  return_date: string;
  max_weight_kg?: number;
  notes?: string;
}

export async function createTrip(
  userId: string,
  payload: CreateTripPayload
): Promise<{ data: TravelTrip | null; error: string | null }> {
  const { data, error } = await supabase
    .from('travel_trips')
    .insert({ user_id: userId, ...payload })
    .select()
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as TravelTrip, error: null };
}

export async function cancelTrip(
  tripId: string
): Promise<string | null> {
  const { error } = await supabase
    .from('travel_trips')
    .update({ status: 'cancelled' as TravelTripStatus })
    .eq('id', tripId);
  return error ? error.message : null;
}
