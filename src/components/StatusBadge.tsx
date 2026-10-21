import { CircleAlert, CircleCheck, CircleDashed, Clock, DoorOpen, type LucideIcon } from 'lucide-react-native';
import { View, type ViewStyle } from 'react-native';

import { radius, type RentStatus, useTheme } from '@/theme';

import { Text } from './Text';

const icons: Record<RentStatus, LucideIcon> = {
  paid: CircleCheck,
  partial: CircleDashed,
  late: CircleAlert,
  upcoming: Clock,
  vacant: DoorOpen,
};

/**
 * Statut de loyer : toujours une icône + un libellé, jamais la couleur seule. Mois payé (ou à venir) mais des mois
 * plus anciens restent dus : « Arriérés ».
 */
export function StatusBadge({ status, arrears = 0, style }: { status: RentStatus; arrears?: number; style?: ViewStyle }) {
  const { status: palette } = useTheme();
  const behind = arrears > 0 && (status === 'paid' || status === 'upcoming');
  const s = behind ? { ...palette.late, label: 'Arriérés' } : palette[status];
  const Icon = behind ? CircleAlert : icons[status];
  return (
    <View
      accessibilityLabel={`Statut : ${s.label}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: s.bg,
        borderRadius: radius.full,
        paddingVertical: 3,
        paddingLeft: 7,
        paddingRight: 9,
        ...style,
      }}>
      <Icon size={14} color={s.fg} strokeWidth={2.25} />
      <Text variant="label" color={s.fg}>
        {s.label}
      </Text>
    </View>
  );
}
