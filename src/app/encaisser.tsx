import { router, useLocalSearchParams } from 'expo-router';
import { Check, FileText, Hand, MessageCircle } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { MethodDot } from '@/components/MethodDot';
import { StatusBadge } from '@/components/StatusBadge';
import { FormError } from '@/components/FormError';
import { errorMessage } from '@/lib/api';
import { Text } from '@/components/Text';
import { methodOrder, methods } from '@/data/methods';
import { allocatePayment, leaseMonths } from '@/data/allocation';
import { addMonthsToPeriod, tenantRent } from '@/data/rent';
import { listStatus, useLeaseMonths, useStore, useTenantSummaries } from '@/data/store';
import type { Payment, PaymentMethod } from '@/data/types';
import type { RentStatus } from '@/theme';
import { formatAmount, formatDate, formatNumber, formatPeriod } from '@/lib/format';
import { noWebOutline } from '@/lib/web';
import { openWhatsApp } from '@/lib/whatsapp';
import { fonts, radius, space, useTheme } from '@/theme';

function Label({ children }: { children: string }) {
  return (
    <Text variant="label" tone="muted" style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
      {children}
    </Text>
  );
}

const ORDER: Record<RentStatus, number> = { late: 0, partial: 1, upcoming: 2, paid: 3, vacant: 4 };

export default function Encaisser() {
  const { c, status } = useTheme();
  const params = useLocalSearchParams<{ tenantId?: string; propertyId?: string; declarationId?: string }>();
  const { collectPayment, today, period, outbox, settings, tenants, units, payments, declarations } = useStore();
  // Paiement signalé par le locataire depuis son espace : montant, moyen et date repris
  const [declaration] = useState(() => declarations.find((d) => d.id === params.declarationId));
  const summaries = useTenantSummaries();

  // Tous les locataires en place : ceux à jour peuvent payer d'avance. En retard d'abord.
  const candidates = useMemo(
    () =>
      summaries
        .filter((s) => !params.propertyId || s.property.id === params.propertyId)
        .sort((a, b) => ORDER[listStatus(a)] - ORDER[listStatus(b)] || a.tenant.lastName.localeCompare(b.tenant.lastName)),
    [summaries, params.propertyId],
  );

  // Ce que chaque locataire doit jusqu'au mois en cours (impayés compris)
  const owedBy = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of candidates) {
      const months = leaseMonths({
        rent: tenantRent(s.tenant, s.unit),
        rule: settings.prorata,
        entryDate: s.tenant.entryDate,
        exitDate: s.tenant.exitDate,
        payments: payments.filter((p) => p.tenantId === s.tenant.id),
        currentPeriod: period,
      });
      map.set(s.tenant.id, months.filter((m) => m.period <= period).reduce((t, m) => t + m.remaining, 0));
    }
    return map;
  }, [candidates, payments, settings.prorata, period]);

  const [tenantId, setTenantId] = useState<string | undefined>(params.tenantId ?? candidates[0]?.tenant.id);
  const selected = summaries.find((s) => s.tenant.id === tenantId);
  const months = useLeaseMonths(tenantId);
  /** Reste dû jusqu'au mois en cours inclus (impayés et mois en cours) */
  const owed = months.filter((m) => m.period <= period).reduce((s, m) => s + m.remaining, 0);
  const monthRent = months.find((m) => m.period === period)?.due ?? selected?.rent ?? 0;

  const [amountText, setAmountText] = useState(() => String(declaration?.amount ?? (owed || monthRent || '')));
  const [startPeriod, setStartPeriod] = useState<string | undefined>();
  const [method, setMethod] = useState<PaymentMethod>(declaration?.method ?? 'cash');
  const [done, setDone] = useState<{ amount: number; payments: Payment[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();

  const amount = Number(amountText.replace(/\D/g, '')) || 0;

  // Aperçu de la répartition (même calcul que le serveur)
  const preview = useMemo(() => {
    const tenant = tenants.find((t) => t.id === tenantId);
    const unit = tenant && units.find((u) => u.id === tenant.unitId);
    if (!tenant || !unit || amount <= 0) return null;
    return allocatePayment({
      rent: tenantRent(tenant, unit),
      rule: settings.prorata,
      entryDate: tenant.entryDate,
      exitDate: tenant.exitDate,
      payments: payments.filter((p) => p.tenantId === tenant.id),
      currentPeriod: period,
      startPeriod,
      amount,
    });
  }, [tenants, units, payments, settings.prorata, tenantId, amount, startPeriod, period]);
  const tooMuch = !!preview && preview.left > 0;

  // Mois proposés : du plus ancien impayé (ou du mois en cours) à trois mois d'avance
  const firstUnpaid = months.find((m) => m.remaining > 0)?.period ?? period;
  const monthChoices = months.filter(
    (m) => m.period >= (firstUnpaid < period ? firstUnpaid : period) && m.period <= addMonthsToPeriod(period, 3),
  );

  const choose = (id: string) => {
    setTenantId(id);
    setStartPeriod(undefined);
    setAmountText('');
  };
  // Montant proposé : tout ce qui reste dû, sinon un mois de loyer (avance)
  useEffect(() => {
    if (!amountText && selected) setAmountText(String(owed || monthRent || ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, owed, monthRent]);

  const save = async () => {
    if (!selected || amount <= 0 || saving || tooMuch) return;
    setSaving(true);
    setSaveError(undefined);
    try {
      const created = await collectPayment({
        tenantId: selected.tenant.id,
        amount,
        method,
        date: declaration && declaration.tenantId === selected.tenant.id ? declaration.paidOn : new Date().toISOString(),
        startPeriod,
        declarationId: declaration && declaration.tenantId === selected.tenant.id ? declaration.id : undefined,
      });
      setDone({ amount, payments: created });
    } catch (e) {
      setSaveError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (done && selected) {
    const covered = done.payments.map((p) => formatPeriod(p.period)).join(', ');
    const receipt =
      `Bonjour ${selected.tenant.firstName}, nous confirmons la réception de ${formatAmount(done.amount)} ` +
      `(${methods[method].label}) pour le loyer de ${covered}, ${selected.unit.label} – ${selected.property.name}. ` +
      `Merci ! Kaza`;
    return (
      <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={{ flex: 1, padding: space.md, gap: space.md, justifyContent: 'center' }}>
          <View style={{ alignItems: 'center', gap: space.sm }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: radius.full,
                backgroundColor: status.paid.bg,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Check size={36} color={status.paid.fg} strokeWidth={2.5} />
            </View>
            <Text variant="h1" style={{ textAlign: 'center' }}>
              Paiement enregistré
            </Text>
            <Text tone="muted" style={{ textAlign: 'center' }}>
              {formatAmount(done.amount)} de {selected.tenant.firstName} {selected.tenant.lastName} · {methods[method].label}
            </Text>
            {done.payments.length > 1 ? (
              <Text tone="muted" style={{ textAlign: 'center' }}>
                Réparti sur {done.payments.length} mois : {covered}.
              </Text>
            ) : null}
            {outbox.some((e) => e.kind === 'allocatePayment' && e.body.ids.includes(done.payments[0].id)) ? (
              <Text variant="small" tone="muted" style={{ textAlign: 'center' }}>
                Pas de réseau : enregistré sur ce téléphone, envoyé automatiquement dès le retour de la connexion.
              </Text>
            ) : null}
          </View>
          {done.payments.map((p) => (
            <Button
              key={p.id}
              label={done.payments.length > 1 ? `Quittance · ${formatPeriod(p.period)}` : 'Voir la quittance'}
              icon={FileText}
              variant={done.payments.length > 1 ? 'secondary' : 'primary'}
              onPress={() => router.replace({ pathname: '/quittance/[id]', params: { id: p.id } })}
            />
          ))}
          <Button
            label="Confirmer sur WhatsApp"
            icon={MessageCircle}
            variant="secondary"
            onPress={() => openWhatsApp(selected.tenant.phone, receipt)}
          />
          <Button label="Terminer" variant="secondary" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.lg, paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
        {declaration ? (
          <View style={{ flexDirection: 'row', gap: space.sm, backgroundColor: c.primarySoft, borderRadius: radius.md, padding: space.sm }}>
            <Hand size={20} color={c.primary} />
            <Text variant="small" style={{ flex: 1 }}>
              Paiement signalé par le locataire : {formatAmount(declaration.amount)} ({methods[declaration.method].label}) le{' '}
              {formatDate(declaration.paidOn)}
              {declaration.reference ? `, référence ${declaration.reference}` : ''}. Vérifiez que l’argent est bien arrivé avant
              d’encaisser.
            </Text>
          </View>
        ) : null}
        <View style={{ gap: space.xs }}>
          <Label>Locataire</Label>
          {params.tenantId && selected ? (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Avatar first={selected.tenant.firstName} last={selected.tenant.lastName} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">
                  {selected.tenant.firstName} {selected.tenant.lastName}
                </Text>
                <Text variant="small" tone="muted">
                  {selected.unit.label} · {selected.property.name}
                </Text>
              </View>
              <StatusBadge status={selected.status} arrears={selected.arrears} />
            </Card>
          ) : (
            <Card padded={false}>
              {candidates.map((s, i) => {
                const on = s.tenant.id === tenantId;
                return (
                  <Pressable
                    key={s.tenant.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    onPress={() => choose(s.tenant.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space.sm,
                      minHeight: 56,
                      paddingHorizontal: space.md,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: c.border,
                      backgroundColor: on ? c.primarySoft : 'transparent',
                    }}>
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: 2,
                        borderColor: on ? c.primary : c.textDisabled,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary }} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong" numberOfLines={1}>
                        {s.tenant.firstName} {s.tenant.lastName}
                      </Text>
                      <Text variant="small" tone="muted" numberOfLines={1}>
                        {s.unit.label} · {owedBy.get(s.tenant.id) ? `dû ${formatNumber(owedBy.get(s.tenant.id)!)}` : 'à jour'}
                      </Text>
                    </View>
                    <StatusBadge status={s.status} arrears={s.arrears} />
                  </Pressable>
                );
              })}
            </Card>
          )}
        </View>

        <View style={{ gap: space.xs }}>
          <Label>Montant reçu</Label>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: c.surface,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: radius.md,
              paddingHorizontal: space.md,
              minHeight: 64,
            }}>
            <TextInput
              value={amount ? formatNumber(amount) : ''}
              onChangeText={setAmountText}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={c.textDisabled}
              accessibilityLabel="Montant reçu en francs CFA"
              style={[{ flex: 1, fontFamily: fonts.bold, fontSize: 28, color: c.text, fontVariant: ['tabular-nums'] }, noWebOutline]}
            />
            <Text variant="h3" tone="muted">
              FCFA
            </Text>
          </View>
          {selected ? (
            <View style={{ flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' }}>
              {owed > 0 ? (
                <Chip label={`Tout le dû · ${formatNumber(owed)}`} selected={amount === owed} onPress={() => setAmountText(String(owed))} />
              ) : null}
              {monthRent > 0 && monthRent !== owed ? (
                <Chip label={`1 mois · ${formatNumber(monthRent)}`} selected={amount === monthRent} onPress={() => setAmountText(String(monthRent))} />
              ) : null}
              {monthRent > 0 ? (
                <Chip
                  label={`${owed > 0 ? 'Dû + 1 mois' : '2 mois'} · ${formatNumber(owed + monthRent * (owed > 0 ? 1 : 2))}`}
                  selected={amount === owed + monthRent * (owed > 0 ? 1 : 2)}
                  onPress={() => setAmountText(String(owed + monthRent * (owed > 0 ? 1 : 2)))}
                />
              ) : null}
            </View>
          ) : null}
        </View>

        {selected && monthChoices.length > 1 ? (
          <View style={{ gap: space.xs }}>
            <Label>Pour le mois de</Label>
            <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
              <Chip label="Le plus ancien dû" selected={!startPeriod} onPress={() => setStartPeriod(undefined)} />
              {monthChoices.map((m) => (
                <Chip
                  key={m.period}
                  label={`${formatPeriod(m.period)}${m.remaining === 0 ? ' ✓' : ''}`}
                  selected={startPeriod === m.period}
                  onPress={() => setStartPeriod(m.period)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {preview && preview.parts.length > 0 ? (
          <Card padded={false}>
            <Text variant="label" tone="muted" style={{ paddingHorizontal: space.md, paddingTop: space.sm }}>
              {preview.parts.length > 1 ? `Réparti sur ${preview.parts.length} mois` : 'Répartition'}
            </Text>
            {preview.parts.map((p) => (
              <View
                key={p.period}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.xs }}>
                <Text style={{ flex: 1, textTransform: 'capitalize' }}>{formatPeriod(p.period)}</Text>
                <Text variant="small" color={p.settles ? status.paid.fg : status.partial.fg}>
                  {p.settles ? (p.period > period ? 'avance' : 'soldé') : `reste ${formatNumber(p.due - p.paidBefore - p.amount)}`}
                </Text>
                <Text variant="bodyStrong" style={{ minWidth: 90, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
                  {formatNumber(p.amount)}
                </Text>
              </View>
            ))}
            {startPeriod && preview.parts.some((p) => p.period < startPeriod) ? (
              <Text variant="small" tone="muted" style={{ paddingHorizontal: space.md, paddingTop: space.xxs }}>
                Les mois plus anciens encore dus sont réglés en premier, puis {formatPeriod(startPeriod)} et les suivants.
              </Text>
            ) : null}
            <View style={{ height: space.xs }} />
          </Card>
        ) : null}
        {tooMuch && preview ? (
          <Text variant="small" color={status.late.fg}>
            Ce montant dépasse ce qui reste dû : {formatAmount(amount - preview.left)} au plus, jusqu’à {formatPeriod(preview.lastPeriod)}.
          </Text>
        ) : null}

        <View style={{ gap: space.xs }}>
          <Label>Mode de paiement</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            {methodOrder.map((m) => {
              const on = m === method;
              return (
                <Pressable
                  key={m}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => setMethod(m)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    minHeight: 48,
                    paddingHorizontal: space.md,
                    borderRadius: radius.md,
                    borderWidth: on ? 2 : 1,
                    borderColor: on ? c.primary : c.border,
                    backgroundColor: on ? c.primarySoft : c.surface,
                  }}>
                  <MethodDot method={m} size={12} />
                  <Text variant="bodyStrong" color={on ? c.primary : c.text}>
                    {methods[m].label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text variant="caption" tone="muted">
            Reçu le {formatDate(today.toISOString())}
          </Text>
        </View>

        <Button
          label={saving ? 'Enregistrement…' : amount > 0 ? `Enregistrer ${formatAmount(amount)}` : 'Saisissez un montant'}
          icon={Check}
          haptic
          disabled={!selected || amount <= 0 || saving || tooMuch}
          onPress={save}
        />
        <FormError message={saveError} />
        {selected && amount > 0 && amount < owed && !tooMuch ? (
          <Text variant="small" color={status.partial.fg} style={{ textAlign: 'center' }}>
            Paiement partiel : il restera {formatAmount(owed - amount)} à payer.
          </Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
