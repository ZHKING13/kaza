import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { sameDay, startOfDay } from '@/lib/dates';
import { formatDate } from '@/lib/format';
import { fonts, radius, space, useTheme } from '@/theme';

import { Text } from './Text';

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

type Props = {
  label: string;
  /** Date ISO */
  value: string;
  onChange: (iso: string) => void;
  min?: Date;
  max?: Date;
  helper?: string;
};

/** Champ date avec calendrier intégré (fonctionne sur Android, iOS et web, sans module natif). */
export function DateField({ label, value, onChange, min, max, helper }: Props) {
  const { c } = useTheme();
  const selected = new Date(value);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(new Date(selected.getFullYear(), selected.getMonth(), 1));
  const today = startOfDay(new Date());

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // lundi = 0
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];
  while (cells.length % 7) cells.push(null);

  const outOfRange = (d: Date) => (min && d < startOfDay(min)) || (max && d > startOfDay(max));
  const canPrev = !min || new Date(month.getFullYear(), month.getMonth(), 0) >= startOfDay(min);
  const canNext = !max || new Date(month.getFullYear(), month.getMonth() + 1, 1) <= startOfDay(max);

  const nav = (dir: -1 | 1, enabled: boolean) => {
    const Icon = dir < 0 ? ChevronLeft : ChevronRight;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={dir < 0 ? 'Mois précédent' : 'Mois suivant'}
        disabled={!enabled}
        onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + dir, 1))}
        style={({ pressed }) => ({
          width: 44,
          height: 44,
          borderRadius: radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? c.surfaceAlt : 'transparent',
          opacity: enabled ? 1 : 0.3,
        })}>
        <Icon size={22} color={c.text} />
      </Pressable>
    );
  };

  return (
    <View style={{ gap: 6 }}>
      <Text variant="label" style={{ fontFamily: fonts.semibold, fontSize: 14 }}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} : ${formatDate(value)}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.xs,
          minHeight: 48,
          paddingHorizontal: space.sm,
          borderRadius: radius.sm,
          borderWidth: open ? 2 : 1,
          borderColor: open ? c.primary : c.border,
          backgroundColor: c.surface,
        }}>
        <CalendarDays size={20} color={c.textMuted} />
        <Text style={{ flex: 1 }}>{formatDate(value)}</Text>
        <Text variant="small" tone="primary" style={{ fontFamily: fonts.medium }}>
          {open ? 'Fermer' : 'Changer'}
        </Text>
      </Pressable>
      {helper ? (
        <Text variant="small" tone="muted">
          {helper}
        </Text>
      ) : null}
      {open ? (
        <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.md, backgroundColor: c.surface, padding: space.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            {nav(-1, canPrev)}
            <Text variant="bodyStrong">
              {MONTHS[month.getMonth()]} {month.getFullYear()}
            </Text>
            {nav(1, canNext)}
          </View>
          <View style={{ flexDirection: 'row' }}>
            {WEEKDAYS.map((w, i) => (
              <Text key={i} variant="caption" tone="muted" style={{ flex: 1, textAlign: 'center', paddingVertical: 4 }}>
                {w}
              </Text>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {cells.map((d, i) => {
              if (!d) return <View key={i} style={{ width: `${100 / 7}%`, height: 44 }} />;
              const on = sameDay(d, selected);
              const disabled = !!outOfRange(d);
              const isToday = sameDay(d, today);
              return (
                <Pressable
                  key={i}
                  accessibilityRole="button"
                  accessibilityLabel={formatDate(d.toISOString())}
                  accessibilityState={{ selected: on, disabled }}
                  disabled={disabled}
                  onPress={() => {
                    onChange(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).toISOString());
                    setOpen(false);
                  }}
                  style={{ width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: radius.full,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: on ? c.primary : 'transparent',
                      borderWidth: isToday && !on ? 1 : 0,
                      borderColor: c.primary,
                    }}>
                    <Text
                      variant="body"
                      color={on ? c.onPrimary : disabled ? c.textDisabled : c.text}
                      style={{ fontVariant: ['tabular-nums'], fontFamily: on ? fonts.semibold : fonts.regular }}>
                      {d.getDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}
