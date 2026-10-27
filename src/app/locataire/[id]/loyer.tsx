import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Check, Square, SquareCheck } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Amount } from '@/components/Amount';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { EmptyState } from '@/components/EmptyState';
import { FormError } from '@/components/FormError';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useServerMessaging } from '@/data/messages';
import { addMonthsToPeriod, rentAt, tenantRent } from '@/data/rent';
import { usePermissions, useStore } from '@/data/store';
import { errorMessage } from '@/lib/api';
import { formatAmount, formatNumber, formatPeriod, periodOf } from '@/lib/format';
import { space, useTheme } from '@/theme';

function Toggle({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48 }}>
      {on ? <SquareCheck size={24} color={c.primary} /> : <Square size={24} color={c.textMuted} />}
      <Text style={{ flex: 1 }}>{label}</Text>
    </Pressable>
  );
}

/** Révision du loyer : historique des montants, nouveau loyer à partir d'un mois (jamais un mois passé). */
export default function RevisionLoyer() {
  const { c, status } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tenants, units, period, payments, reviseRent, cancelRentRevision, remote: isRemote } = useStore();
  const { can } = usePermissions();
  const canManage = can('leases.manage');
  const { enabled: messaging } = useServerMessaging();
  const tenant = tenants.find((t) => t.id === id);
  const unit = units.find((u) => u.id === tenant?.unitId);

  const entryPeriod = tenant?.entryDate ? periodOf(new Date(tenant.entryDate)) : period;
  const first = addMonthsToPeriod(entryPeriod, 1) > period ? addMonthsToPeriod(entryPeriod, 1) : period;
  const choices = Array.from({ length: 6 }, (_, i) => addMonthsToPeriod(first, i));

  const [amount, setAmount] = useState(0);
  const [from, setFrom] = useState(choices[first === period ? 1 : 0]);
  const [reason, setReason] = useState('');
  const [notify, setNotify] = useState(true);
  const [applyToUnit, setApplyToUnit] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [cancelling, setCancelling] = useState<string | null>(null);

  if (!tenant || !unit || tenant.exitDate || !canManage) {
    return <EmptyState icon={Check} title="Révision impossible" body="Ce locataire est parti, ou votre rôle ne le permet pas." />;
  }

  const schedule = tenantRent(tenant, unit);
  const before = rentAt(schedule, addMonthsToPeriod(from, -1));
  const change = amount > 0 && before > 0 ? ((amount - before) / before) * 100 : 0;
  const fromPaid = payments.filter((p) => p.tenantId === tenant.id && p.period === from).reduce((s, p) => s + p.amount, 0);
  const invalid = amount <= 0 ? 'Indiquez le nouveau loyer.' : amount === before ? `Le loyer est déjà de ${formatAmount(before)}.` : undefined;

  const history = [
    { id: null as string | null, from: schedule[0].from, amount: schedule[0].amount, reason: 'Loyer à l’entrée' },
    ...(tenant.rents ?? []).map((r) => ({ id: r.id as string | null, from: r.from, amount: r.amount, reason: r.reason })),
  ];

  const save = async () => {
    setSubmitted(true);
    if (invalid || saving) return;
    setSaving(true);
    setError(undefined);
    try {
      await reviseRent({
        tenantId: tenant.id,
        amount,
        from,
        reason: reason.trim() || undefined,
        notifyTenant: messaging && notify,
        applyToUnit,
      });
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const toCancel = cancelling ? history.find((h) => h.id === cancelling) : undefined;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Réviser le loyer' }} />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        <Text tone="muted">
          {tenant.firstName} {tenant.lastName} · {unit.label}
        </Text>

        <Text variant="h3" accessibilityRole="header">
          Historique du loyer
        </Text>
        <Card padded={false}>
          {history.map((h, i) => (
            <View
              key={h.id ?? 'entry'}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.sm,
                padding: space.md,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: c.border,
              }}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" style={{ textTransform: 'capitalize' }}>
                  {h.from > period ? `À partir de ${formatPeriod(h.from)}` : formatPeriod(h.from)}
                </Text>
                {h.reason ? (
                  <Text variant="small" tone="muted">
                    {h.reason}
                  </Text>
                ) : null}
              </View>
              <Amount value={h.amount} currency={false} />
              {h.id && h.from >= period ? (
                <Button label="Annuler" variant="ghost" compact onPress={() => setCancelling(h.id)} />
              ) : null}
            </View>
          ))}
        </Card>

        <Text variant="h3" accessibilityRole="header">
          Nouveau loyer
        </Text>
        <TextField
          label="Montant mensuel"
          keyboardType="number-pad"
          value={amount ? formatNumber(amount) : ''}
          onChangeText={(t) => setAmount(Number(t.replace(/\D/g, '')) || 0)}
          suffix="FCFA"
          placeholder={formatNumber(before)}
          error={submitted ? invalid : undefined}
          helper={
            amount > 0 && amount !== before
              ? `${amount > before ? '+' : ''}${formatAmount(amount - before)} par mois (${change > 0 ? '+' : ''}${change.toFixed(1).replace('.', ',')} %) par rapport à ${formatAmount(before)}.`
              : `Loyer actuel : ${formatAmount(before)}.`
          }
          style={{ fontVariant: ['tabular-nums'] }}
        />
        <View style={{ gap: 6 }}>
          <Text variant="label" style={{ fontSize: 14 }}>
            À partir de
          </Text>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            {choices.map((p) => (
              <Chip key={p} label={formatPeriod(p)} selected={from === p} onPress={() => setFrom(p)} />
            ))}
          </View>
          <Text variant="small" tone="muted">
            Les mois passés gardent leur loyer.
            {fromPaid > 0 && amount > fromPaid
              ? ` ${formatPeriod(from)} est déjà payé ${formatAmount(fromPaid)} : ${formatAmount(amount - fromPaid)} resteront à payer.`
              : ''}
          </Text>
        </View>
        <TextField label="Motif (facultatif)" value={reason} onChangeText={setReason} placeholder="Révision annuelle" maxLength={120} />
        {messaging ? (
          <Toggle on={notify} label={`Prévenir ${tenant.firstName} par WhatsApp`} onPress={() => setNotify(!notify)} />
        ) : null}
        {isRemote ? (
          <Toggle
            on={applyToUnit}
            label={`Appliquer aussi à ${unit.label} pour les prochains locataires`}
            onPress={() => setApplyToUnit(!applyToUnit)}
          />
        ) : null}
        {submitted && invalid ? (
          <Text variant="small" color={status.late.fg}>
            {invalid}
          </Text>
        ) : null}
      </ScrollView>
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: space.md,
          paddingTop: space.sm,
          paddingBottom: insets.bottom + space.sm,
          backgroundColor: c.bg,
          borderTopWidth: 1,
          borderTopColor: c.border,
        }}>
        <FormError message={error} />
        <Button
          label={saving ? 'Enregistrement…' : 'Enregistrer la révision'}
          icon={Check}
          onPress={save}
          disabled={saving}
        />
      </View>
      <ConfirmSheet
        visible={!!toCancel}
        title="Retirer cette révision ?"
        message={toCancel ? `Le loyer de ${formatAmount(toCancel.amount)} prévu à partir de ${formatPeriod(toCancel.from)} est retiré ; le loyer précédent continue de s’appliquer.` : undefined}
        confirmLabel="Retirer la révision"
        onClose={() => setCancelling(null)}
        onConfirm={() => cancelRentRevision(tenant.id, cancelling!)}
      />
    </KeyboardAvoidingView>
  );
}
