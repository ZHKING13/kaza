import { router, useLocalSearchParams } from 'expo-router';
import { Check, FileText, MessageCircle } from 'lucide-react-native';
import { useMemo, useState } from 'react';
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
import { useStore, useTenantSummaries } from '@/data/store';
import type { PaymentMethod } from '@/data/types';
import { formatAmount, formatDate, formatNumber, formatPeriod } from '@/lib/format';
import { openWhatsApp } from '@/lib/whatsapp';
import { fonts, radius, space, useTheme } from '@/theme';

function Label({ children }: { children: string }) {
  return (
    <Text variant="label" tone="muted" style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
      {children}
    </Text>
  );
}

export default function Encaisser() {
  const { c, status } = useTheme();
  const params = useLocalSearchParams<{ tenantId?: string; propertyId?: string }>();
  const { addPayment, today, period, outbox } = useStore();
  const summaries = useTenantSummaries();

  const candidates = useMemo(
    () =>
      summaries
        .filter((s) => s.status !== 'paid' && s.due > 0 && (!params.propertyId || s.property.id === params.propertyId))
        .sort((a, b) => (a.status === 'late' ? -1 : 0) - (b.status === 'late' ? -1 : 0)),
    [summaries, params.propertyId],
  );

  const [tenantId, setTenantId] = useState<string | undefined>(params.tenantId ?? candidates[0]?.tenant.id);
  const selected = summaries.find((s) => s.tenant.id === tenantId);
  const remaining = selected ? Math.max(selected.due - selected.paid, 0) : 0;

  const [amountText, setAmountText] = useState(remaining ? String(remaining) : '');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [done, setDone] = useState<{ amount: number; paymentId: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();

  const amount = Number(amountText.replace(/\D/g, '')) || 0;

  const choose = (id: string) => {
    setTenantId(id);
    const s = summaries.find((x) => x.tenant.id === id);
    if (s) setAmountText(String(Math.max(s.due - s.paid, 0) || s.due));
  };

  const save = async () => {
    if (!selected || amount <= 0 || saving) return;
    setSaving(true);
    setSaveError(undefined);
    try {
      const paymentId = await addPayment({ tenantId: selected.tenant.id, amount, method, date: new Date().toISOString(), period });
      setDone({ amount, paymentId });
    } catch (e) {
      setSaveError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (done && selected) {
    const receipt =
      `Bonjour ${selected.tenant.firstName}, nous confirmons la réception de ${formatAmount(done.amount)} ` +
      `(${methods[method].label}) pour le loyer de ${formatPeriod(period)}, ${selected.unit.label} – ${selected.property.name}. ` +
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
            {outbox.some((e) => e.kind === 'createPayment' && e.body.id === done.paymentId) ? (
              <Text variant="small" tone="muted" style={{ textAlign: 'center' }}>
                Pas de réseau : enregistré sur ce téléphone, envoyé automatiquement dès le retour de la connexion.
              </Text>
            ) : null}
          </View>
          <Button
            label="Voir la quittance"
            icon={FileText}
            onPress={() => router.replace({ pathname: '/quittance/[id]', params: { id: done.paymentId } })}
          />
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
              <StatusBadge status={selected.status} />
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
                        {s.unit.label} · reste {formatNumber(s.due - s.paid)}
                      </Text>
                    </View>
                    <StatusBadge status={s.status} />
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
              style={{ flex: 1, fontFamily: fonts.bold, fontSize: 28, color: c.text, fontVariant: ['tabular-nums'] }}
            />
            <Text variant="h3" tone="muted">
              FCFA
            </Text>
          </View>
          {selected ? (
            <View style={{ flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' }}>
              <Chip label={`Reste dû · ${formatNumber(remaining)}`} selected={amount === remaining} onPress={() => setAmountText(String(remaining))} />
              <Chip label={`Loyer · ${formatNumber(selected.due)}`} selected={amount === selected.due && remaining !== selected.due} onPress={() => setAmountText(String(selected.due))} />
            </View>
          ) : null}
        </View>

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
            Reçu le {formatDate(today.toISOString())} · loyer de {formatPeriod(period)}
          </Text>
        </View>

        <Button
          label={saving ? 'Enregistrement…' : amount > 0 ? `Enregistrer ${formatAmount(amount)}` : 'Saisissez un montant'}
          icon={Check}
          haptic
          disabled={!selected || amount <= 0 || saving}
          onPress={save}
        />
        <FormError message={saveError} />
        {selected && amount > 0 && amount < remaining ? (
          <Text variant="small" color={status.partial.fg} style={{ textAlign: 'center' }}>
            Paiement partiel : il restera {formatAmount(remaining - amount)} à payer.
          </Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
