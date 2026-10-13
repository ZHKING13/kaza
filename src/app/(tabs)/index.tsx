import { router } from 'expo-router';
import { Bell, Building2, CircleAlert, DoorOpen, type LucideIcon, Send, UserPlus } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Fab } from '@/components/Fab';
import { KazaMark } from '@/components/KazaMark';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { PaymentRow } from '@/components/PaymentRow';
import { Text } from '@/components/Text';
import { useMonthTotals, useStore, useTenantSummaries } from '@/data/store';
import { formatAmount, formatNumber, formatPeriod } from '@/lib/format';
import { radius, space, useTheme } from '@/theme';

function NextStep({
  icon: Icon,
  title,
  body,
  action,
  onPress,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action: string;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Card style={{ gap: space.sm, borderColor: c.primary, borderWidth: 1.5 }}>
      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.md,
            backgroundColor: c.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon size={22} color={c.primary} />
        </View>
        <Text variant="h3" style={{ flex: 1 }}>
          {title}
        </Text>
      </View>
      <Text tone="muted">{body}</Text>
      <Button label={action} onPress={onPress} />
    </Card>
  );
}

function greeting(d: Date) {
  return d.getHours() < 18 ? 'Bonjour' : 'Bonsoir';
}

export default function Accueil() {
  const { c, status } = useTheme();
  const { payments, today, period, profile, properties, mode } = useStore();
  const summaries = useTenantSummaries();
  const totals = useMonthTotals();
  const pct = totals.expected ? Math.round((totals.collected / totals.expected) * 100) : 0;
  const recent = payments.slice(0, 4);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Screen
        subtitle={greeting(today) + ','}
        title={profile.firstName}
        bottomInset={96}
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={mode === 'demo' ? 'Notifications, 3 nouvelles' : 'Notifications'}
              style={{
                width: 48,
                height: 48,
                borderRadius: radius.full,
                borderWidth: 1,
                borderColor: c.border,
                backgroundColor: c.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Bell size={22} color={c.text} />
              {mode === 'demo' ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 11,
                    right: 12,
                    width: 9,
                    height: 9,
                    borderRadius: 5,
                    backgroundColor: status.late.fg,
                    borderWidth: 2,
                    borderColor: c.surface,
                  }}
                />
              ) : null}
            </Pressable>
          </View>
        }>
        {/* Résumé du mois : la réponse à « où en sont mes loyers ? » */}
        {summaries.length ? (
          <>
            <View style={{ backgroundColor: c.primary, borderRadius: radius.lg, padding: space.md, gap: space.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="small" color={c.onPrimary} style={{ opacity: 0.9 }}>
                  Encaissé en {formatPeriod(period).split(' ')[0]}
                </Text>
                <KazaMark size={22} color={c.onPrimary} />
              </View>
              <Amount value={totals.collected} variant="amountXL" color={c.onPrimary} />
              <View
                accessibilityLabel={`${pct} % des loyers encaissés`}
                style={{ height: 8, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
                <View style={{ width: `${pct}%`, height: '100%', backgroundColor: c.onPrimary, borderRadius: radius.full }} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="caption" color={c.onPrimary}>
                  {pct} % de {formatNumber(totals.expected)}
                </Text>
                <Text variant="caption" color={c.onPrimary}>
                  {totals.paidCount} / {totals.tenantCount} locataires à jour
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Card style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <CircleAlert size={16} color={status.late.fg} />
                  <Text variant="small" tone="muted">
                    Impayés
                  </Text>
                </View>
                <Amount
                  value={totals.outstanding}
                  currency={false}
                  variant="h2"
                  color={status.late.fg}
                  style={{ fontVariant: ['tabular-nums'] }}
                />
              </Card>
              <Card style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <DoorOpen size={16} color={c.textMuted} />
                  <Text variant="small" tone="muted">
                    Unités vacantes
                  </Text>
                </View>
                <Text variant="h2">{totals.vacantCount}</Text>
              </Card>
            </View>
          </>
        ) : null}

        {totals.lateCount > 0 ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
              backgroundColor: status.late.bg,
              borderRadius: radius.md,
              padding: space.sm,
              paddingLeft: space.md,
            }}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong" color={status.late.fg}>
                {totals.lateCount} locataires en retard
              </Text>
              <Text variant="small" color={status.late.fg}>
                {formatAmount(totals.outstanding)} à recevoir
              </Text>
            </View>
            <Button label="Relancer" icon={Send} variant="danger" compact />
          </View>
        ) : null}

        {properties.length === 0 ? (
          <NextStep
            icon={Building2}
            title="Ajoutez votre premier bien"
            body="Une cour, une villa, un immeuble : commencez par le décrire et indiquer ses unités."
            action="Ajouter un bien"
            onPress={() => router.push('/bien/nouveau')}
          />
        ) : summaries.length === 0 ? (
          <NextStep
            icon={UserPlus}
            title="Ajoutez vos locataires"
            body="Pour chaque unité louée : nom, téléphone, loyer et avance. Kaza suivra les paiements."
            action="Ajouter un locataire"
            onPress={() => router.push('/locataire/nouveau')}
          />
        ) : null}

        {recent.length ? (
          <>
            <SectionHeader title="Paiements récents" actionLabel="Voir tout" href="/paiements" />
            <Card padded={false}>
              {recent.map((p, i) => (
                <PaymentRow key={p.id} payment={p} summaries={summaries} first={i === 0} />
              ))}
            </Card>
          </>
        ) : null}
      </Screen>
      {summaries.length ? <Fab /> : null}
    </View>
  );
}
