import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Check, LogOut, MessageCircle, Plus, Square, SquareCheck, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { DateField } from '@/components/DateField';
import { EmptyState } from '@/components/EmptyState';
import { MethodDot } from '@/components/MethodDot';
import { PdfButton } from '@/components/PdfButton';
import { SettlementSummary } from '@/components/SettlementSummary';
import { useSettlementDoc } from '@/data/documents';
import { FormError } from '@/components/FormError';
import { errorMessage } from '@/lib/api';
import { Text } from '@/components/Text';
import { computeSettlement } from '@/data/ledger';
import { prorataRules, rentForPeriod } from '@/data/prorata';
import { byMethod, methodOrder, methods } from '@/data/methods';
import { useStore } from '@/data/store';
import type { PaymentMethod, Settlement } from '@/data/types';
import { dayLabel, formatAmount, formatDate, formatNumber, formatPeriod, periodOf } from '@/lib/format';
import { openWhatsApp } from '@/lib/whatsapp';
import { fonts, radius, space, useTheme } from '@/theme';

const SUGGESTIONS = ['Réparations', 'Peinture', 'Facture d’eau', 'Facture d’électricité', 'Clés non rendues'];

type Deduction = { key: string; label: string; amount: number };
let k = 0;

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

export default function DepartLocataire() {
  const { c, status } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tenants, units, properties, payments, today, recordDeparture, settings } = useStore();
  const tenant = tenants.find((t) => t.id === id);
  const unit = units.find((u) => u.id === tenant?.unitId);
  const property = properties.find((p) => p.id === unit?.propertyId);

  const [exitDate, setExitDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12).toISOString());
  const [deductArrears, setDeductArrears] = useState(true);
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>('cash');
  const [done, setDone] = useState<Settlement | null>(null);
  const [saveError, setSaveError] = useState<string>();
  const settlementDoc = useSettlementDoc(id);

  const preview = useMemo(
    () =>
      tenant && unit
        ? computeSettlement({
            tenant,
            rent: unit.rent,
            payments,
            exitDate,
            deductArrears,
            deductions: deductions.map(({ label, amount }) => ({ label, amount })),
            rule: settings.prorata,
          })
        : null,
    [tenant, unit, payments, exitDate, deductArrears, deductions, settings.prorata],
  );

  if (done && tenant && unit && property) {
    const msg =
      `Bonjour ${tenant.firstName}, voici votre solde de tout compte pour ${unit.label} – ${property.name}, ` +
      `départ le ${formatDate(exitDate)}. Caution : ${formatAmount(done.deposit)}` +
      (done.prepaid ? `, avance non consommée : ${formatAmount(done.prepaid)}` : '') +
      (done.arrearsDeducted ? `, impayés retenus : ${formatAmount(done.arrearsDeducted)}` : '') +
      done.deductions.filter((d) => d.amount > 0).map((d) => `, ${d.label || 'retenue'} : ${formatAmount(d.amount)}`).join('') +
      '. ' +
      (done.balance >= 0
        ? `Nous vous remboursons ${formatAmount(done.balance)}${done.refundMethod ? ` ${byMethod(done.refundMethod)}` : ''}. `
        : `Il reste ${formatAmount(-done.balance)} à régler. `) +
      `Merci et bonne continuation. Kaza`;
    return (
      <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: c.bg }}>
        <Stack.Screen options={{ title: 'Départ enregistré', headerLeft: () => null }} />
        <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md }}>
          <View style={{ alignItems: 'center', gap: space.xs, paddingVertical: space.md }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: radius.full,
                backgroundColor: c.surfaceAlt,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <LogOut size={30} color={c.text} />
            </View>
            <Text variant="h2" style={{ textAlign: 'center' }}>
              Départ de {tenant.firstName} {tenant.lastName} enregistré
            </Text>
            <Text tone="muted" style={{ textAlign: 'center' }}>
              {unit.label} est maintenant vacante.
            </Text>
          </View>
          <SettlementSummary s={done} />
          {settlementDoc ? <PdfButton label="Partager le solde (PDF)" html={settlementDoc.html} fileName={settlementDoc.fileName} variant="primary" /> : null}
          <Button label="Envoyer le résumé sur WhatsApp" icon={MessageCircle} variant="secondary" onPress={() => openWhatsApp(tenant.phone, msg)} />
          <Button label="Terminer" variant="secondary" onPress={() => router.back()} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!tenant || !unit || !property || !preview || tenant.exitDate) {
    return <EmptyState icon={LogOut} title="Locataire introuvable" body="Ce locataire est peut-être déjà parti." />;
  }

  const b = preview.balanceDetail;
  const update = (key: string, patch: Partial<Deduction>) => setDeductions(deductions.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const input = {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: c.text,
    minHeight: 48,
    minWidth: 0,
    paddingHorizontal: space.sm,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.sm,
    backgroundColor: c.surface,
  } as const;

  const save = async () => {
    setSaveError(undefined);
    try {
      const s = await recordDeparture({
        tenantId: tenant.id,
        exitDate,
        deductArrears,
        deductions: deductions.filter((d) => d.amount > 0).map(({ label, amount }) => ({ label: label.trim() || 'Retenue', amount })),
        refundMethod,
      });
      setDone(s);
    } catch (e) {
      setSaveError(errorMessage(e));
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Départ du locataire' }} />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.xl, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Avatar first={tenant.firstName} last={tenant.lastName} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">
              {tenant.firstName} {tenant.lastName}
            </Text>
            <Text variant="small" tone="muted">
              {unit.label} · {property.name}
              {tenant.entryDate ? ` · entré le ${formatDate(tenant.entryDate)}` : ''}
            </Text>
          </View>
        </Card>

        <Section title="Date de départ">
          <DateField
            label="Le locataire quitte le logement le"
            value={exitDate}
            onChange={setExitDate}
            min={tenant.entryDate ? new Date(tenant.entryDate) : new Date(today.getFullYear() - 2, today.getMonth(), 1)}
            max={today}
            helper={(() => {
              const p = periodOf(new Date(exitDate));
              const last = rentForPeriod(unit.rent, p, settings.prorata, tenant.entryDate, exitDate);
              return last.partial
                ? `Dernier mois (${prorataRules[settings.prorata].label.toLowerCase()}, du ${dayLabel(last.fromDay)} au ${last.toDay}) : ${formatAmount(last.amount)} au lieu de ${formatAmount(unit.rent)}.`
                : `Le loyer de ${formatPeriod(p)} est dû en entier (${prorataRules[settings.prorata].label.toLowerCase()}).`;
            })()}
          />
        </Section>

        <Section title="Impayés">
          {b.arrearsByPeriod.length === 0 ? (
            <Text tone="muted">Aucun impayé jusqu’au mois du départ.</Text>
          ) : (
            <>
              <Card style={{ paddingVertical: space.xxs }}>
                {b.arrearsByPeriod.map((a, i) => (
                  <View
                    key={a.period}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      paddingVertical: space.xs,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: c.border,
                    }}>
                    <Text style={{ textTransform: 'capitalize' }}>{formatPeriod(a.period)}</Text>
                    <Text variant="bodyStrong" color={status.late.fg} style={{ fontVariant: ['tabular-nums'] }}>
                      {formatAmount(a.amount)}
                    </Text>
                  </View>
                ))}
              </Card>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: deductArrears }}
                onPress={() => setDeductArrears(!deductArrears)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48 }}>
                {deductArrears ? <SquareCheck size={24} color={c.primary} /> : <Square size={24} color={c.textMuted} />}
                <Text style={{ flex: 1 }}>Retenir les impayés ({formatAmount(b.arrears)}) sur la caution</Text>
              </Pressable>
            </>
          )}
        </Section>

        <Section title="Autres retenues">
          {deductions.map((d) => (
            <View key={d.key} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
              <TextInput
                value={d.label}
                onChangeText={(label) => update(d.key, { label })}
                placeholder="Motif"
                placeholderTextColor={c.textMuted}
                accessibilityLabel="Motif de la retenue"
                style={[input, { flex: 1.3 }]}
              />
              <TextInput
                value={d.amount ? formatNumber(d.amount) : ''}
                onChangeText={(t) => update(d.key, { amount: Number(t.replace(/\D/g, '')) || 0 })}
                keyboardType="number-pad"
                placeholder="Montant"
                placeholderTextColor={c.textMuted}
                accessibilityLabel={`Montant : ${d.label || 'retenue'}`}
                style={[input, { flex: 1, fontVariant: ['tabular-nums'] }]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Supprimer la retenue ${d.label}`}
                onPress={() => setDeductions(deductions.filter((x) => x.key !== d.key))}
                style={({ pressed }) => ({
                  width: 48,
                  height: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: radius.sm,
                  backgroundColor: pressed ? c.surfaceAlt : 'transparent',
                })}>
                <Trash2 size={20} color={c.textMuted} />
              </Pressable>
            </View>
          ))}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            {SUGGESTIONS.filter((s) => !deductions.some((d) => d.label === s)).map((s) => (
              <Chip key={s} label={`+ ${s}`} selected={false} onPress={() => setDeductions([...deductions, { key: `r${k++}`, label: s, amount: 0 }])} />
            ))}
            <Chip label="+ Autre" selected={false} onPress={() => setDeductions([...deductions, { key: `r${k++}`, label: '', amount: 0 }])} />
          </View>
        </Section>

        <Section title="Solde de tout compte">
          <SettlementSummary s={preview} />
          {preview.balance > 0 ? (
            <View style={{ gap: 6 }}>
              <Text variant="label" style={{ fontFamily: fonts.semibold, fontSize: 14 }}>
                Remboursement par
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
                {methodOrder.map((m) => {
                  const on = m === refundMethod;
                  return (
                    <Pressable
                      key={m}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      onPress={() => setRefundMethod(m)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        minHeight: 44,
                        paddingHorizontal: space.sm,
                        borderRadius: radius.md,
                        borderWidth: on ? 2 : 1,
                        borderColor: on ? c.primary : c.border,
                        backgroundColor: on ? c.primarySoft : c.surface,
                      }}>
                      <MethodDot method={m} size={10} />
                      <Text variant="small" color={on ? c.primary : c.text} style={{ fontFamily: fonts.semibold }}>
                        {methods[m].short}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </Section>
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
          gap: 4,
        }}>
        <Text variant="small" tone="muted" style={{ textAlign: 'center' }}>
          {unit.label} redeviendra vacante.
        </Text>
        <FormError message={saveError} />
        <Button label="Confirmer le départ" icon={Check} haptic onPress={save} />
      </View>
    </KeyboardAvoidingView>
  );
}
