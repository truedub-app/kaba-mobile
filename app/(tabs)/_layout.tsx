import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        // AppTabBar in the root layout is the real tab bar.
        tabBarStyle: { display: 'none' },
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index"     options={{ title: 'Home' }} />
      <Tabs.Screen name="browse"    options={{ title: 'Browse' }} />
      <Tabs.Screen name="favorites" options={{ title: 'Favorites' }} />
      <Tabs.Screen name="messages"  options={{ title: 'Messages' }} />
      <Tabs.Screen name="profile"   options={{ title: 'Profile' }} />
      {/* No tab button — href: null removes the flex slot entirely */}
      <Tabs.Screen name="seller-dashboard" options={{ href: null }} />
      {/* Detail screens live in a nested Stack so back navigation works */}
      <Tabs.Screen name="(detail)"         options={{ href: null }} />
    </Tabs>
  );
}
