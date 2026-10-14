import { router } from 'expo-router';
import { CalendarClock, TrendingUp } from 'lucide-react-native';
import { View } from 'react-native';

import { Amount } from './Amount';
import { Button } from './Button';
import { Card } from './Card';
import { Text } from './Text';
import { defaultLeaseSettings, leaseEnd, rentSteps, tenantRent, toCalendar } from '@/data/rent';
import { useStore } from '@/data/store';
import type { Tenant, Unit } from '@/data/types';
import { formatAmount, formatDate, formatPeriod } from '@/lib/format';
import { space, useTheme } from '@/theme';

/** « dans 12 jours », « aujourd'hui », « il y a 3 jours » */
export function inDays(days: number): string {
  if (days === 0) return 'aujourd’hui';
  if (days === 1) return 'demain';
  if (days > 0) return `dans ${days} jours`;
  return days === -1 ? 'hier' : `il y a ${-days} jours`;
}

/** Bandeau de la fiche : préavis en cours, ou contrat proche de sa fin ou échu. */
export function LeaseEndBanner({ tenant }: { tenant: Tenant }) {
  const { status } = useTheme();
  const { today, settings } = useStore();
  const end = leaseEnd(
    {
      endDate: tenant.endDate ? toCalendar(tenant.endDate) : null,
      notice: tenant.notice ? { exitDate: toCalendar(tenant.notice.exitDate) } : null,
    },
    toCalendar(today.toISOString()),
    (settings.leases ?? defaultLeaseSettings).leaseEndAlertDays,
  );
  if (!end) return null;
  const tone = end.kind === 'contract_end' ? status.upcoming : status.partial;
  const text =
    end.kind === 'notice'
      ? `Préavis ${tenant.notice!.from === 'tenant' ? 'du locataire' : 'du bailleur'} : départ prévu le ${formatDate(tenant.notice!.exitDate)} (${inDays(end.daysLeft)}).`
      : end.kind === 'contract_end'
        ? `Fin du contrat le ${formatDate(tenant.endDate!)} (${inDays(end.daysLeft)}). Prolongez-le ou enregistrez un préavis.`
        : `Contrat échu le ${formatDate(tenant.endDate!)} : le bail continue. Prolongez-le pour le mettre à jour.`;
  return (
    <View
      accessibilityRole="alert"
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: tone.bg, borderRadius: 12, padding: space.sm }}>
      <CalendarClock size={18} color={tone.fg} />
      <Text variant="small" color={tone.fg} style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

/** Bail : loyer actuel et prochaine révision, fin du contrat, préavis ; accès à la révision et au contrat. */
export function LeaseTerms({ tenant, unit, canManage }: { tenant: Tenant; unit: Unit; canManage: boolean }) {
  const { c } = useTheme();
  const { period } = useStore();
  const steps = rentSteps(tenantRent(tenant, unit));
  const currentIndex = steps.reduce((i, s, idx) => (s.from <= period ? idx : i), 0);
  const current = steps[currentIndex];
  const nextStep = steps.find((s) => s.from > period);

  const row = (label: string, value: React.ReactNode, first = false) => (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: space.sm,
        paddingVertical: space.sm,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: c.border,
      }}>
      <Text tone="muted">{label}</Text>
      {value}
    </View>
  );

  return (
    <View style={{ gap: space.sm }}>
      <Text variant="h3" accessibilityRole="header">
        Bail
      </Text>
      <Card style={{ paddingVertical: space.xxs }}>
        {currentIndex > 0 ? row(`Loyer depuis ${formatPeriod(current.from)}`, <Amount value={current.amount} />, true) : null}
        {nextStep
          ? row(
              `À partir de ${formatPeriod(nextStep.from)}`,
              <Text variant="bodyStrong" tone="primary" style={{ fontVariant: ['tabular-nums'] }}>
                {formatAmount(nextStep.amount)}
              </Text>,
            )
          : null}
        {row(
          'Fin du contrat',
          <Text variant="bodyStrong">{tenant.endDate ? formatDate(tenant.endDate) : 'Durée indéterminée'}</Text>,
          currentIndex === 0 && !nextStep,
        )}
        {tenant.notice
          ? row(
              tenant.notice.from === 'tenant' ? 'Préavis du locataire' : 'Préavis du bailleur',
              <Text variant="bodyStrong">départ le {formatDate(tenant.notice.exitDate)}</Text>,
            )
          : null}
      </Card>
      {canManage ? (
        <View style={{ gap: space.xs }}>
          <Button
            label="Réviser le loyer"
            icon={TrendingUp}
            variant="secondary"
            onPress={() => router.push({ pathname: '/locataire/[id]/loyer', params: { id: tenant.id } })}
          />
          <Button
            label="Fin du contrat et préavis"
            icon={CalendarClock}
            variant="secondary"
            onPress={() => router.push({ pathname: '/locataire/[id]/contrat', params: { id: tenant.id } })}
          />
        </View>
      ) : null}
    </View>
  );
}
