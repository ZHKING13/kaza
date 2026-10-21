import { router, Stack } from 'expo-router';
import { BadgeCheck, Bell, CalendarClock, CheckCheck, CircleAlert, type LucideIcon, Receipt, Settings, Users, Wallet } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { FormError } from '@/components/FormError';
import { Text } from '@/components/Text';
import { useStore, useTenantSummaries } from '@/data/store';
import { errorMessage } from '@/lib/api';
import { formatAmount, formatPeriod } from '@/lib/format';
import { type AppNotification, notificationsApi, openNotificationTarget, setUnread } from '@/lib/notifications';
import type { PushCategory } from '@/lib/push';
import { fonts, radius, space, useTheme } from '@/theme';

const icons: Record<PushCategory, LucideIcon> = {
  payments: Wallet,
  late: CircleAlert,
  lease: CalendarClock,
  subscription: BadgeCheck,
  team: Users,
  teamPayments: Receipt,
};

/** « à l'instant », « il y a 5 min », « il y a 3 h », « hier », « 12 oct. » */
function ago(iso: string, now: Date): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  if (minutes < 24 * 60) return `il y a ${Math.floor(minutes / 60)} h`;
  if (minutes < 48 * 60) return 'hier';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/** Démo : trois notifications d'exemple tirées des locataires fictifs. */
function useDemoNotifications(enabled: boolean): AppNotification[] {
  const summaries = useTenantSummaries();
  const { period } = useStore();
  return useMemo(() => {
    if (!enabled) return [];
    const now = Date.now();
    const at = (minutes: number) => new Date(now - minutes * 60000).toISOString();
    const late = summaries.filter((s) => s.status === 'late' || s.status === 'partial');
    const paid = summaries.find((s) => s.status === 'paid');
    const items: AppNotification[] = [];
    if (paid) {
      items.push({
        id: 'demo-paid',
        organizationId: null,
        category: 'payments',
        title: 'Loyer reçu',
        body: `${paid.tenant.firstName} ${paid.tenant.lastName} a payé ${formatAmount(paid.paid)} en ligne (${paid.unit.label}, ${formatPeriod(period)}).`,
        data: { screen: 'tenant', leaseId: paid.tenant.id },
        readAt: null,
        createdAt: at(12),
      });
    }
    if (late.length) {
      items.push({
        id: 'demo-late',
        organizationId: null,
        category: 'late',
        title: `${late.length} loyer${late.length > 1 ? 's' : ''} en retard`,
        body: `${formatAmount(late.reduce((s, x) => s + x.due - x.paid, 0))} restent à encaisser ce mois-ci.`,
        data: { screen: 'late' },
        readAt: null,
        createdAt: at(60 * 5),
      });
    }
    const ending = summaries.find((s) => s.tenant.notice || s.tenant.endDate) ?? summaries[1];
    if (ending) {
      items.push({
        id: 'demo-lease',
        organizationId: null,
        category: 'lease',
        title: 'Fin de contrat proche',
        body: `Le bail de ${ending.tenant.firstName} ${ending.tenant.lastName} (${ending.unit.label}, ${ending.property.name}) arrive à échéance : pensez au renouvellement.`,
        data: { screen: 'tenant', leaseId: ending.tenant.id },
        readAt: null,
        createdAt: at(60 * 30),
      });
    }
    return items;
    // Une seule fois par ouverture de l'écran
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}

/**
 * La cloche : les notifications des 90 derniers jours (paiements reçus, retards, fins de contrat, offre, équipe),
 * selon les réglages des notifications. Toucher une notification ouvre l'écran concerné.
 */
export default function Notifications() {
  const { c } = useTheme();
  const { mode, remote, organizationId, organizations, switchOrganization } = useStore();
  const demo = mode === 'demo';
  const demoItems = useDemoNotifications(demo);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();
  const now = useMemo(() => new Date(), [items]);

  const load = useCallback(
    async (before?: string) => {
      if (demo) {
        setItems((prev) => (prev.length ? prev : demoItems));
        setLoaded(true);
        return;
      }
      if (!remote) {
        setLoaded(true);
        return;
      }
      try {
        const page = await notificationsApi.list(before);
        setItems((prev) => (before ? [...prev, ...page.items] : page.items));
        setHasMore(page.hasMore);
        setUnread(page.unread);
        setError(undefined);
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setLoaded(true);
      }
    },
    [demo, remote, demoItems],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const unread = items.filter((n) => !n.readAt).length;

  const markRead = async (ids?: string[]) => {
    const stamp = new Date().toISOString();
    const next = items.map((n) => (!n.readAt && (!ids || ids.includes(n.id)) ? { ...n, readAt: stamp } : n));
    setItems(next);
    if (demo) {
      setUnread(next.filter((n) => !n.readAt).length);
      return;
    }
    try {
      const r = await notificationsApi.read(ids);
      setUnread(r.unread);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const open = async (n: AppNotification) => {
    if (!n.readAt) void markRead([n.id]);
    await openNotificationTarget(n.data, { organizationId, organizations, switchOrganization });
  };

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xxl }}
      refreshControl={
        remote ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        ) : undefined
      }>
      <Stack.Screen options={{ title: 'Notifications' }} />

      {!demo && !remote ? (
        <EmptyState
          icon={Bell}
          title="Notifications avec un compte"
          body="Créez un compte pour recevoir ici les paiements en ligne, les retards, les fins de contrat et les nouvelles de votre équipe."
        />
      ) : loaded && items.length === 0 && !error ? (
        <EmptyState
          icon={Bell}
          title="Rien de nouveau"
          body="Les paiements reçus, les loyers en retard, les fins de contrat et les nouvelles de votre équipe s’afficheront ici."
        />
      ) : null}

      {items.length > 0 ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
            <Text variant="small" tone="muted" style={{ flex: 1 }}>
              {unread ? `${unread} non lue${unread > 1 ? 's' : ''}` : 'Tout est lu'}
            </Text>
            {unread ? <Button label="Tout marquer comme lu" icon={CheckCheck} variant="ghost" compact onPress={() => markRead()} /> : null}
          </View>
          <Card padded={false}>
            {items.map((n, i) => {
              const Icon = icons[n.category] ?? Bell;
              const fresh = !n.readAt;
              return (
                <Pressable
                  key={n.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${fresh ? 'Non lue. ' : ''}${n.title}. ${n.body}. ${ago(n.createdAt, now)}`}
                  onPress={() => open(n)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    gap: space.sm,
                    padding: space.md,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: c.border,
                    backgroundColor: pressed ? c.surfaceAlt : fresh ? c.primarySoft + '55' : 'transparent',
                  })}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: radius.full,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: fresh ? c.primarySoft : c.surfaceAlt,
                    }}>
                    <Icon size={18} color={fresh ? c.primary : c.textMuted} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                      <Text variant="bodyStrong" style={{ flex: 1, fontFamily: fresh ? fonts.semibold : fonts.medium }} numberOfLines={1}>
                        {n.title}
                      </Text>
                      <Text variant="caption" tone="muted">
                        {ago(n.createdAt, now)}
                      </Text>
                    </View>
                    <Text variant="small" tone={fresh ? 'text' : 'muted'}>
                      {n.body}
                    </Text>
                  </View>
                  {fresh ? (
                    <View
                      accessibilityElementsHidden
                      importantForAccessibility="no"
                      style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent, marginTop: 6 }}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </Card>
        </>
      ) : null}

      {hasMore ? <Button label="Voir plus" variant="secondary" onPress={() => load(items[items.length - 1]?.createdAt)} /> : null}
      <FormError message={error} />

      {remote || demo ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/parametres')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'center', padding: space.sm }}>
          <Settings size={16} color={c.textMuted} />
          <Text variant="small" tone="muted">
            Choisir les notifications reçues · gardées 90 jours
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}
