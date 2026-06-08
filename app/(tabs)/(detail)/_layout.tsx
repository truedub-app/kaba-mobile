import { Stack } from 'expo-router';

const HEADER = {
  headerBackTitle: '',
  headerTintColor: '#15803d',
  headerShadowVisible: false,
  headerStyle: { backgroundColor: '#fff' },
} as const;

export default function DetailLayout() {
  return (
    <Stack>
      <Stack.Screen name="listing/[id]"        options={{ headerShown: false }} />
      <Stack.Screen name="listing/create"       options={{ title: 'New Listing',    ...HEADER }} />
      <Stack.Screen name="listing/edit/[id]"    options={{ title: 'Edit Listing',   ...HEADER }} />
      <Stack.Screen name="listing/boost/[id]"   options={{ title: 'Boost Listing',  ...HEADER }} />
      <Stack.Screen name="chat/[id]"            options={{ ...HEADER }} />
      <Stack.Screen name="user/[id]"            options={{ title: 'Seller Profile', ...HEADER }} />
      <Stack.Screen name="seller/apply"         options={{ title: 'Become a Seller',...HEADER }} />
      <Stack.Screen name="abroad/[id]"          options={{ headerShown: false }} />
    </Stack>
  );
}
