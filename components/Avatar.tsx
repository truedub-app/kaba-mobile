import React from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import { getAvatarUrl, initials } from '@/src/lib/utils';

interface Props {
  name: string | null | undefined;
  avatarUrl: string | null | undefined;
  size?: number;
  verified?: boolean;
}

const COLORS = ['#15803d', '#16a34a', '#166534', '#14532d', '#4ade80'];

function seedColor(name: string): string {
  const n = name.charCodeAt(0) + (name.charCodeAt(1) ?? 0);
  return COLORS[n % COLORS.length];
}

export function Avatar({ name, avatarUrl, size = 40, verified = false }: Props) {
  const url = getAvatarUrl(avatarUrl);
  const label = initials(name);
  const bg = seedColor(name ?? '?');

  return (
    <View style={{ width: size, height: size }}>
      {url ? (
        <Image
          source={{ uri: url }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              color: '#fff',
              fontWeight: '700',
              fontSize: size * 0.35,
            }}
          >
            {label}
          </Text>
        </View>
      )}
      {verified && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: size * 0.35,
            height: size * 0.35,
            borderRadius: size * 0.175,
            backgroundColor: '#15803d',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: '#fff',
          }}
        >
          <Text style={{ color: '#fff', fontSize: size * 0.18, fontWeight: '700' }}>✓</Text>
        </View>
      )}
    </View>
  );
}
