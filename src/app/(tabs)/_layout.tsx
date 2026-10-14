import { Tabs } from 'expo-router/js-tabs';
import { Building2, Ellipsis, House, Users, Wallet } from 'lucide-react-native';

import { useMonthTotals } from '@/data/store';
import { fonts, useTheme } from '@/theme';

export default function TabLayout() {
  const { c, status } = useTheme();
  const { lateCount } = useMonthTotals();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border, minHeight: 64 },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12 },
        tabBarItemStyle: { paddingVertical: 4 },
        sceneStyle: { backgroundColor: c.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarIcon: ({ color }) => <House color={color} size={24} /> }} />
      <Tabs.Screen name="biens" options={{ title: 'Biens', tabBarIcon: ({ color }) => <Building2 color={color} size={24} /> }} />
      <Tabs.Screen name="paiements" options={{ title: 'Paiements', tabBarIcon: ({ color }) => <Wallet color={color} size={24} /> }} />
      <Tabs.Screen
        name="locataires"
        options={{
          title: 'Locataires',
          tabBarIcon: ({ color }) => <Users color={color} size={24} />,
          tabBarBadge: lateCount > 0 ? lateCount : undefined,
          tabBarBadgeStyle: { backgroundColor: status.late.fg, color: c.surface, fontFamily: fonts.semibold, fontSize: 11 },
        }}
      />
      <Tabs.Screen name="plus" options={{ title: 'Plus', tabBarIcon: ({ color }) => <Ellipsis color={color} size={24} /> }} />
    </Tabs>
  );
}
