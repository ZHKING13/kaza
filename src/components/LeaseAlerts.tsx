import { router } from 'expo-router';
import { CalendarClock, ChevronRight, TrendingUp } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Card } from './Card';
import { inDays } from './LeaseTerms';
import { Text } from './Text';
import { type LeaseAlerts as Alerts, useLeaseAlerts } from '@/data/store';
import { formatAmount, formatDate, formatPeriod } from '@/lib/format';
import { radius, space, useTheme } from '@/theme';

const MAX = 3;

function endLabel({ end, summary }: Alerts['ending'][number]): string {
  if (end.kind === 'notice') return `Préavis : départ ${formatDate(end.date)} (${inDays(end.daysLeft)})`;
  if (end.kind === 'contract_end') return `Fin du contrat ${formatDate(end.date)} (${inDays(end.daysLeft)})`;
  return `Contrat échu depuis le ${formatDate(summary.tenant.endDate!)}`;
}

function AlertCard({
  icon: Icon,
  title,
  tone,
  rows,
  more,
}: {
  icon: typeof CalendarClock;
  title: string;
  tone: { fg: string; bg: string };
  rows: { key: string; name: string; detail: string; tenantId: string }[];
  more: number;
}) {
  const { c } = useTheme();
  return (
    <Card padded={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, padding: space.md, paddingBottom: space.xs }}>
        <View style={{ backgroundColor: tone.bg, borderRadius: radius.full, padding: 6 }}>
          <Icon size={16} color={tone.fg} />
        </View>
        <Text variant="bodyStrong" accessibilityRole="header" style={{ flex: 1 }}>
          {title}
        </Text>
        <Text variant="small" tone="muted">
          {rows.length + more}
        </Text>
      </View>
      {rows.map((r) => (
        <Pressable
          key={r.key}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/locataire/[id]', params: { id: r.tenantId } })}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
            paddingHorizontal: space.md,
            paddingVertical: space.sm,
            borderTopWidth: 1,
            borderTopColor: c.border,
            backgroundColor: pressed ? c.surfaceAlt : 'transparent',
          })}>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{r.name}</Text>
            <Text variant="small" tone="muted">
              {r.detail}
            </Text>
          </View>
          <ChevronRight size={18} color={c.textMuted} />
        </Pressable>
      ))}
      {more > 0 ? (
        <Text variant="small" tone="muted" style={{ paddingHorizontal: space.md, paddingBottom: space.sm }}>
          Et {more} autre{more > 1 ? 's' : ''}.
        </Text>
      ) : null}
    </Card>
  );
}

/** Accueil : baux qui arrivent à leur fin (préavis, fin de contrat) et loyers à réviser. */
export function LeaseAlerts() {
  const { status } = useTheme();
  const { ending, revisions } = useLeaseAlerts();
  if (!ending.length && !revisions.length) return null;
  return (
    <View style={{ gap: space.sm }}>
      {ending.length ? (
        <AlertCard
          icon={CalendarClock}
          title="Fin de contrat proche"
          tone={status.partial}
          rows={ending.slice(0, MAX).map((x) => ({
            key: x.summary.tenant.id,
            tenantId: x.summary.tenant.id,
            name: `${x.summary.tenant.firstName} ${x.summary.tenant.lastName} · ${x.summary.unit.label}`,
            detail: endLabel(x),
          }))}
          more={Math.max(ending.length - MAX, 0)}
        />
      ) : null}
      {revisions.length ? (
        <AlertCard
          icon={TrendingUp}
          title="Révision de loyer"
          tone={status.upcoming}
          rows={revisions.slice(0, MAX).map(({ summary, since }) => ({
            key: summary.tenant.id,
            tenantId: summary.tenant.id,
            name: `${summary.tenant.firstName} ${summary.tenant.lastName} · ${summary.unit.label}`,
            detail: `${formatAmount(summary.rent)} depuis ${formatPeriod(since)}`,
          }))}
          more={Math.max(revisions.length - MAX, 0)}
        />
      ) : null}
    </View>
  );
}
