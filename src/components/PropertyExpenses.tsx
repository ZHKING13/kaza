import { router } from 'expo-router';
import { Paperclip, Plus, Receipt, Repeat } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Amount } from './Amount';
import { Button } from './Button';
import { Card } from './Card';
import { EmptyState } from './EmptyState';
import { Text } from './Text';
import { expenseCategories, expenseMethods } from '@/data/expenses';
import { useExpenses, usePermissions, useReport, useStore } from '@/data/store';
import { formatAmount, formatDate, formatNumber, formatPeriod } from '@/lib/format';
import { radius, space, useTheme } from '@/theme';

/** Fiche du bien › Dépenses : net du mois et de l'année, dépenses mensuelles en cours, liste des dépenses. */
export function PropertyExpenses({ propertyId }: { propertyId: string }) {
  const { c, status } = useTheme();
  const { period, units, expenseSchedules } = useStore();
  const { canManage } = usePermissions();
  const expenses = useExpenses(propertyId);
  const ids = [propertyId];
  const month = useReport(period, period, ids).totals;
  const year = useReport(`${period.slice(0, 4)}-01`, period, ids).totals;
  const schedules = expenseSchedules.filter((s) => s.propertyId === propertyId);
  const unitLabel = (id?: string) => (id ? units.find((u) => u.id === id)?.label : undefined);

  const figure = (name: string, value: number, color?: string, strong = false) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.xs }}>
      <Text variant={strong ? 'bodyStrong' : 'small'} color={color} tone={color ? undefined : 'muted'}>
        {name}
      </Text>
      <Text variant={strong ? 'bodyStrong' : 'small'} color={color} style={{ fontVariant: ['tabular-nums'] }}>
        {formatNumber(value)}
      </Text>
    </View>
  );
  const line = (label: string, t: typeof month) => (
    <View style={{ flex: 1, gap: 2 }}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      {figure('Encaissé', t.collected)}
      {figure('Dépenses', t.expenses, t.expenses ? status.late.fg : undefined)}
      {figure('Net', t.net, t.net < 0 ? status.late.fg : c.primary, true)}
    </View>
  );
  const monthName = formatPeriod(period);

  return (
    <View style={{ gap: space.sm }}>
      <Card style={{ flexDirection: 'row', gap: space.md }}>
        {line(monthName.charAt(0).toUpperCase() + monthName.slice(1), month)}
        <View style={{ width: 1, backgroundColor: c.border }} />
        {line(`Depuis janvier ${period.slice(0, 4)}`, year)}
      </Card>
      <Text variant="caption" tone="muted" style={{ textAlign: 'center', marginTop: -space.xs }}>
        Montants en FCFA · loyers du mois qu’ils règlent
      </Text>

      {schedules.length ? (
        <View style={{ gap: space.xs }}>
          <Text variant="label" tone="muted">
            Chaque mois
          </Text>
          {schedules.map((s) => (
            <View
              key={s.id}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: radius.md, backgroundColor: c.primarySoft }}>
              <Repeat size={16} color={c.primary} />
              <Text variant="small" style={{ flex: 1 }}>
                {expenseCategories[s.category].label}
                {s.supplier ? ` · ${s.supplier}` : ''} · le {s.dayOfMonth}
              </Text>
              <Text variant="bodyStrong">{formatAmount(s.amount)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Card padded={false}>
        {expenses.length ? (
          expenses.map((e, i) => (
            <Pressable
              key={e.id}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/depense/[id]', params: { id: e.id } })}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.sm,
                minHeight: 60,
                paddingHorizontal: space.md,
                paddingVertical: space.xs,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: c.border,
                backgroundColor: pressed ? c.surfaceAlt : 'transparent',
              })}>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
                    {e.supplier || expenseCategories[e.category].label}
                  </Text>
                  {e.scheduleId ? <Repeat size={14} color={c.textMuted} /> : null}
                  {e.receipt ? <Paperclip size={14} color={c.textMuted} /> : null}
                </View>
                <Text variant="small" tone="muted" numberOfLines={1}>
                  {formatDate(e.date)} · {expenseCategories[e.category].short}
                  {unitLabel(e.unitId) ? ` · ${unitLabel(e.unitId)}` : ''} · {expenseMethods[e.method].label}
                </Text>
              </View>
              <Amount value={e.amount} currency={false} />
            </Pressable>
          ))
        ) : (
          <EmptyState icon={Receipt} title="Aucune dépense" body="Travaux, gardien, charges, impôt foncier : notez-les pour connaître ce que le bien rapporte vraiment." />
        )}
      </Card>
      {canManage ? (
        <Button
          label="Ajouter une dépense"
          icon={Plus}
          variant="secondary"
          onPress={() => router.push({ pathname: '/depense/nouvelle', params: { propertyId } })}
        />
      ) : null}
    </View>
  );
}
