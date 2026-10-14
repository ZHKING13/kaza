import { router, Stack, useLocalSearchParams } from 'expo-router';
import { CalendarCheck, CalendarClock, CalendarPlus, LogOut, Undo2 } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { DateField } from '@/components/DateField';
import { EmptyState } from '@/components/EmptyState';
import { FormError } from '@/components/FormError';
import { inDays } from '@/components/LeaseTerms';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { daysBetween, defaultLeaseSettings, fromCalendar, type NoticeFrom, noticeExitDate, toCalendar } from '@/data/rent';
import { usePermissions, useStore } from '@/data/store';
import { errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { space, useTheme } from '@/theme';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="h3" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

const noon = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).toISOString();

/** Fin du contrat (prolonger, durée indéterminée) et préavis (enregistrer, retirer, puis départ). */
export default function ContratLocataire() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tenants, today, settings, setEndDate, giveNotice, withdrawNotice } = useStore();
  const { canManage } = usePermissions();
  const tenant = tenants.find((t) => t.id === id);
  const rules = settings.leases ?? defaultLeaseSettings;
  const todayIso = noon(today);

  const [hasEnd, setHasEnd] = useState(!!tenant?.endDate);
  const [endDate, setEnd] = useState(
    () => tenant?.endDate ?? noon(new Date(today.getFullYear() + 1, today.getMonth(), today.getDate())),
  );
  const [from, setFrom] = useState<NoticeFrom>('tenant');
  const [noticeDate, setNoticeDate] = useState(todayIso);
  const [exitEdited, setExitEdited] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<string>();

  if (!tenant || tenant.exitDate || !canManage) {
    return <EmptyState icon={CalendarClock} title="Modification impossible" body="Ce locataire est parti, ou votre rôle ne le permet pas." />;
  }

  const defaultExit = fromCalendar(noticeExitDate(toCalendar(noticeDate), from, rules));
  const exitDate = exitEdited ?? defaultExit;
  const entry = tenant.entryDate ? new Date(tenant.entryDate) : new Date(today.getFullYear() - 2, 0, 1);
  const endChanged = hasEnd ? toCalendar(endDate) !== (tenant.endDate ? toCalendar(tenant.endDate) : null) : !!tenant.endDate;

  const run = async (action: () => Promise<void>, done?: string) => {
    setBusy(true);
    setError(undefined);
    setSaved(undefined);
    try {
      await action();
      setSaved(done);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const extend = (years: number) => {
    const base = new Date(endDate);
    setHasEnd(true);
    setEnd(noon(new Date(base.getFullYear() + years, base.getMonth(), base.getDate())));
  };

  const notice = tenant.notice;
  const noticeDays = notice ? daysBetween(toCalendar(todayIso), toCalendar(notice.exitDate)) : 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Fin du contrat et préavis' }} />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.lg, paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
        <Text tone="muted">
          {tenant.firstName} {tenant.lastName}
          {tenant.entryDate ? ` · entré le ${formatDate(tenant.entryDate)}` : ''}
        </Text>

        <Section title="Fin du contrat">
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            <Chip label="Durée indéterminée" selected={!hasEnd} onPress={() => setHasEnd(false)} />
            <Chip label="Date de fin" selected={hasEnd} onPress={() => setHasEnd(true)} />
          </View>
          {hasEnd ? (
            <DateField
              label="Le contrat prend fin le"
              value={endDate}
              onChange={setEnd}
              min={new Date(entry.getFullYear(), entry.getMonth(), entry.getDate() + 1)}
              max={new Date(today.getFullYear() + 10, 11, 31)}
              helper={`Kaza vous prévient ${rules.leaseEndAlertDays} jours avant. Sans préavis, le bail continue après cette date.`}
            />
          ) : null}
          {hasEnd && tenant.endDate ? (
            <Button label="Prolonger d’un an" icon={CalendarPlus} variant="ghost" compact onPress={() => extend(1)} />
          ) : null}
          {!hasEnd ? (
            <Text variant="small" tone="muted">
              Pas de date de fin : le bail court jusqu’à un préavis.
            </Text>
          ) : null}
          {endChanged ? (
            <Button
              label={busy ? 'Enregistrement…' : 'Enregistrer la fin du contrat'}
              icon={CalendarCheck}
              disabled={busy}
              onPress={() => run(() => setEndDate(tenant.id, hasEnd ? endDate : null), 'Fin du contrat enregistrée.')}
            />
          ) : null}
        </Section>

        <Section title="Préavis">
          {notice ? (
            <Card style={{ gap: space.xs }}>
              <Text variant="bodyStrong">
                {notice.from === 'tenant' ? 'Le locataire part' : 'Le bailleur met fin au bail'} : départ prévu le{' '}
                {formatDate(notice.exitDate)} ({inDays(noticeDays)}).
              </Text>
              <Text variant="small" tone="muted">
                Préavis donné le {formatDate(notice.date)}
                {notice.reason ? ` · ${notice.reason}` : ''}
              </Text>
              {noticeDays <= 0 ? (
                <Button
                  label="Enregistrer le départ"
                  icon={LogOut}
                  onPress={() => router.replace({ pathname: '/locataire/[id]/depart', params: { id: tenant.id } })}
                />
              ) : null}
              <Button
                label="Retirer le préavis"
                icon={Undo2}
                variant="ghost"
                disabled={busy}
                onPress={() => run(() => withdrawNotice(tenant.id), 'Préavis retiré.')}
              />
            </Card>
          ) : (
            <>
              <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
                <Chip
                  label="Le locataire part"
                  selected={from === 'tenant'}
                  onPress={() => {
                    setFrom('tenant');
                    setExitEdited(null);
                  }}
                />
                <Chip
                  label="Le bailleur met fin au bail"
                  selected={from === 'landlord'}
                  onPress={() => {
                    setFrom('landlord');
                    setExitEdited(null);
                  }}
                />
              </View>
              <DateField
                label="Préavis donné le"
                value={noticeDate}
                onChange={(d) => {
                  setNoticeDate(d);
                  setExitEdited(null);
                }}
                min={entry}
                max={today}
              />
              <DateField
                label="Départ prévu le"
                value={exitDate}
                onChange={setExitEdited}
                min={new Date(noticeDate)}
                max={new Date(today.getFullYear() + 2, 11, 31)}
                helper={`Par défaut : ${from === 'tenant' ? rules.noticeTenantMonths : rules.noticeLandlordMonths} mois de préavis (réglable dans les paramètres).`}
              />
              <TextField label="Motif (facultatif)" value={reason} onChangeText={setReason} placeholder="Mutation, fin de contrat…" maxLength={200} />
              <Text variant="small" tone="muted">
                Kaza enregistre le préavis pour vous le rappeler ; il ne l’envoie pas au locataire. Un préavis du bailleur
                se donne par écrit (lettre remise contre signature, ou acte d’huissier).
              </Text>
              <Button
                label={busy ? 'Enregistrement…' : 'Enregistrer le préavis'}
                icon={CalendarClock}
                disabled={busy}
                onPress={() =>
                  run(
                    () => giveNotice(tenant.id, { from, date: noticeDate, exitDate, reason: reason.trim() || undefined }),
                    'Préavis enregistré.',
                  )
                }
              />
            </>
          )}
        </Section>

        {saved ? (
          <Text variant="small" tone="primary" accessibilityRole="alert">
            {saved}
          </Text>
        ) : null}
        <FormError message={error} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
