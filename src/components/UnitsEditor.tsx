import { Copy, Plus, Trash2 } from 'lucide-react-native';
import { Pressable, TextInput, View } from 'react-native';

import { formatAmount, formatNumber } from '@/lib/format';
import { nextUnitLabel } from '@/lib/units';
import { fonts, radius, space, useTheme } from '@/theme';

import { Button } from './Button';
import { Text } from './Text';

export type UnitDraft = { key: string; label: string; rent: number };

let k = 0;
export const draftKey = () => `d${k++}`;

/** Liste d'unités modifiable. « Dupliquer » recopie la dernière ligne avec le nom suivant. */
export function UnitsEditor({ value, onChange }: { value: UnitDraft[]; onChange: (next: UnitDraft[]) => void }) {
  const { c } = useTheme();
  const update = (key: string, patch: Partial<UnitDraft>) => onChange(value.map((u) => (u.key === key ? { ...u, ...patch } : u)));
  const last = value[value.length - 1];
  const total = value.reduce((s, u) => s + u.rent, 0);

  const input = {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: c.text,
    minHeight: 48,
    paddingHorizontal: space.sm,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.sm,
    backgroundColor: c.surface,
  } as const;

  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', gap: space.xs, paddingRight: 48 + space.xs }}>
        <Text variant="label" tone="muted" style={{ flex: 1.2 }}>
          NOM DE L’UNITÉ
        </Text>
        <Text variant="label" tone="muted" style={{ flex: 1 }}>
          LOYER (FCFA)
        </Text>
      </View>
      {value.map((u, i) => (
        <View key={u.key} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <TextInput
            value={u.label}
            onChangeText={(label) => update(u.key, { label })}
            placeholder="Ex. Chambre 1"
            placeholderTextColor={c.textMuted}
            accessibilityLabel={`Nom de l’unité ${i + 1}`}
            style={[input, { flex: 1.2, minWidth: 0 }]}
          />
          <TextInput
            value={u.rent ? formatNumber(u.rent) : ''}
            onChangeText={(t) => update(u.key, { rent: Number(t.replace(/\D/g, '')) || 0 })}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={c.textMuted}
            accessibilityLabel={`Loyer de l’unité ${i + 1}`}
            style={[input, { flex: 1, minWidth: 0, fontVariant: ['tabular-nums'] }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Supprimer ${u.label || `l’unité ${i + 1}`}`}
            disabled={value.length === 1}
            onPress={() => onChange(value.filter((x) => x.key !== u.key))}
            style={({ pressed }) => ({
              width: 48,
              height: 48,
              borderRadius: radius.sm,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? c.surfaceAlt : 'transparent',
              opacity: value.length === 1 ? 0.3 : 1,
            })}>
            <Trash2 size={20} color={c.textMuted} />
          </Pressable>
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: space.xs }}>
        <Button
          label={last?.label ? `Dupliquer → ${nextUnitLabel(last.label)}` : 'Dupliquer'}
          icon={Copy}
          variant="secondary"
          style={{ flex: 1 }}
          disabled={!last}
          onPress={() => last && onChange([...value, { key: draftKey(), label: nextUnitLabel(last.label), rent: last.rent }])}
        />
        <Button
          label="Vide"
          icon={Plus}
          variant="ghost"
          accessibilityLabel="Ajouter une unité vide"
          onPress={() => onChange([...value, { key: draftKey(), label: '', rent: 0 }])}
        />
      </View>
      <Text variant="small" tone="muted">
        {value.length} unité{value.length > 1 ? 's' : ''} · {formatAmount(total)} de loyers par mois
      </Text>
    </View>
  );
}
