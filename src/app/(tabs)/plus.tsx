import { ChevronRight, Crown, FileText, LifeBuoy, type LucideIcon, Settings, UsersRound } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { router } from 'expo-router';

import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { KazaMark } from '@/components/KazaMark';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { prorataRules } from '@/data/prorata';
import { useStore } from '@/data/store';
import { formatPhone } from '@/lib/format';
import { radius, space, useTheme } from '@/theme';

function Row({ icon: Icon, label, hint, first, onPress }: { icon: LucideIcon; label: string; hint?: string; first?: boolean; onPress?: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        minHeight: 56,
        paddingHorizontal: space.md,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: c.border,
        backgroundColor: pressed ? c.surfaceAlt : 'transparent',
      })}>
      <Icon size={22} color={c.textMuted} />
      <Text style={{ flex: 1 }}>{label}</Text>
      {hint ? (
        <Text variant="small" tone="muted">
          {hint}
        </Text>
      ) : null}
      <ChevronRight size={20} color={c.textMuted} />
    </Pressable>
  );
}

export default function Plus() {
  const { c } = useTheme();
  const { settings } = useStore();
  return (
    <Screen title="Plus">
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Avatar first="Kouassi" last="Brou" size={52} />
        <View style={{ flex: 1 }}>
          <Text variant="h3">Kouassi Brou</Text>
          <Text variant="small" tone="muted">
            {formatPhone('+2250700112233')}
          </Text>
        </View>
      </Card>

      <View
        style={{
          backgroundColor: c.surface,
          borderColor: c.accent,
          borderWidth: 1,
          borderRadius: radius.md,
          padding: space.md,
          flexDirection: 'row',
          gap: space.sm,
          alignItems: 'center',
        }}>
        <Crown size={24} color={c.accent} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">Offre Pro · 19 unités sur 30</Text>
          <Text variant="small" tone="muted">
            Renouvellement le 1er novembre
          </Text>
        </View>
      </View>

      <Card padded={false}>
        <Row icon={UsersRound} label="Équipe et gérants" hint="1 gérant" first />
        <Row icon={FileText} label="Rapports et exports" />
        <Row icon={Settings} label="Paramètres" hint={prorataRules[settings.prorata].label} onPress={() => router.push('/parametres')} />
        <Row icon={LifeBuoy} label="Aide sur WhatsApp" />
      </Card>

      <View style={{ alignItems: 'center', gap: space.xs, paddingTop: space.lg }}>
        <KazaMark size={28} />
        <Text variant="caption" tone="muted">
          Kaza 0.1.0 · Le loyer, sans courir.
        </Text>
      </View>
    </Screen>
  );
}
