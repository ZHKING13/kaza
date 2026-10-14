import { Contact } from 'expo-contacts';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { BookUser, Check, DoorOpen, MessageCircle, UserRound, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { DateField } from '@/components/DateField';
import { EmptyState } from '@/components/EmptyState';
import { MethodDot } from '@/components/MethodDot';
import { Stepper } from '@/components/Stepper';
import { PhoneField } from '@/components/PhoneField';
import { FormError } from '@/components/FormError';
import { errorMessage } from '@/lib/api';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { countries, type Country, splitPhone } from '@/data/countries';
import { methodOrder, methods } from '@/data/methods';
import { rentForPeriod } from '@/data/prorata';
import { advancePeriods, useStore } from '@/data/store';
import type { PaymentMethod } from '@/data/types';
import { dayLabel, formatAmount, formatDate, formatNumber, formatPeriod, periodOf } from '@/lib/format';
import { openWhatsApp } from '@/lib/whatsapp';
import { fonts, radius, space, useTheme } from '@/theme';

const DUE_DAYS = [1, 5, 10, 15, 25];

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

function FieldLabel({ children }: { children: string }) {
  return (
    <Text variant="label" style={{ fontFamily: fonts.semibold, fontSize: 14 }}>
      {children}
    </Text>
  );
}

/** Mois couverts par l'avance à partir du mois d'entrée, ex. « octobre 2026 à décembre 2026 » */
function advanceRange(months: number, from: Date) {
  const p = (i: number) => formatPeriod(periodOf(new Date(from.getFullYear(), from.getMonth() + i, 1)));
  return months <= 1 ? p(0) : `${p(0)} à ${p(months - 1)}`;
}

/** Fin d'un contrat de `years` ans : la veille de l'anniversaire de l'entrée (ISO, midi). */
function contractEnd(entryDate: string, years: number): string {
  const d = new Date(entryDate);
  return new Date(d.getFullYear() + years, d.getMonth(), d.getDate() - 1, 12).toISOString();
}

export default function NouveauLocataire() {
  const { c, status } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ unitId?: string }>();
  const { units, tenants, properties, addTenant, today, settings, profile } = useStore();

  const vacant = useMemo(() => {
    const occupied = new Set(tenants.filter((t) => !t.exitDate).map((t) => t.unitId));
    return units.filter((u) => !occupied.has(u.id));
  }, [units, tenants]);

  const [unitId, setUnitId] = useState<string | undefined>(
    params.unitId && vacant.some((u) => u.id === params.unitId)
      ? params.unitId
      : vacant.length === 1
        ? vacant[0].id // une seule unité libre : choisie d'office
        : undefined,
  );
  const [choosingUnit, setChoosingUnit] = useState(!unitId);
  const unit = units.find((u) => u.id === unitId);
  const property = properties.find((p) => p.id === unit?.propertyId);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  // Par défaut, le pays du bailleur (un bailleur à Dakar loue surtout à des numéros sénégalais)
  const [country, setCountry] = useState<Country>(() => splitPhone(profile.phone || '', countries[0]).country);
  const [national, setNational] = useState('');
  const [rent, setRent] = useState(unit?.rent ?? 0);
  const [dueDay, setDueDay] = useState(5);
  /** Durée du contrat en années (0 : indéterminée) */
  const [years, setYears] = useState(0);
  const [entryDate, setEntryDate] = useState(() =>
    new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12).toISOString(),
  );
  const entry = new Date(entryDate);
  const entryPeriod = periodOf(entry);
  const currentPeriod = periodOf(today);
  const firstMonth = rentForPeriod(rent, entryPeriod, settings.prorata, entryDate);
  const [advance, setAdvance] = useState(1);
  const [advanceMethod, setAdvanceMethod] = useState<PaymentMethod>('cash');
  const [deposit, setDeposit] = useState(2);
  const advanceTotal = advancePeriods(advance, entry).reduce(
    (s, p) => s + rentForPeriod(rent, p, settings.prorata, entryDate).amount,
    0,
  );
  const [submitted, setSubmitted] = useState(false);
  const [contactError, setContactError] = useState<string>();
  const [createdId, setCreatedId] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();

  const chooseUnit = (id: string) => {
    setUnitId(id);
    setRent(units.find((u) => u.id === id)?.rent ?? 0);
    setChoosingUnit(false);
  };

  const importContact = async () => {
    setContactError(undefined);
    try {
      const contact = await Contact.presentPicker();
      if (!contact) return;
      const [given, family, phones] = await Promise.all([contact.getGivenName(), contact.getFamilyName(), contact.getPhones()]);
      if (given) setFirstName(given);
      if (family) setLastName(family);
      const number = phones.find((p) => p.number)?.number;
      if (number) {
        const split = splitPhone(number, country);
        setCountry(split.country);
        setNational(split.national);
      }
    } catch {
      setContactError(
        'Impossible d’ouvrir vos contacts. Autorisez l’accès dans les réglages du téléphone, ou saisissez le numéro.',
      );
    }
  };

  const digits = national.replace(/\D/g, '');
  const errors = {
    unit: !unit ? 'Choisissez l’unité louée.' : undefined,
    firstName: !firstName.trim() ? 'Indiquez le prénom.' : undefined,
    lastName: !lastName.trim() ? 'Indiquez le nom.' : undefined,
    phone: !digits
      ? 'Indiquez le numéro de téléphone.'
      : digits.length !== country.length
        ? `Un numéro en ${country.name} compte ${country.length} chiffres (${digits.length} saisis).`
        : undefined,
    rent: rent <= 0 ? 'Indiquez le loyer mensuel.' : undefined,
  };
  const valid = Object.values(errors).every((e) => !e);
  const show = (e?: string) => (submitted ? e : undefined);

  const save = async () => {
    setSubmitted(true);
    if (!valid || !unit || saving) return;
    setSaving(true);
    setSaveError(undefined);
    try {
      const id = await addTenant({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: `+${country.dial}${digits}`,
        unitId: unit.id,
        dueDay,
        depositMonths: deposit,
        entryDate,
        endDate: years > 0 ? contractEnd(entryDate, years) : undefined,
        rent,
        advanceMonths: advance,
        advanceMethod,
      });
      setCreatedId(id);
    } catch (e) {
      setSaveError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (createdId && unit && property) {
    const welcome =
      `Bonjour ${firstName.trim()}, bienvenue à ${property.name} (${unit.label}) ! ` +
      `Votre loyer est de ${formatAmount(rent)}, à régler le ${dueDay} de chaque mois. ` +
      (advance > 0 ? `Votre avance couvre ${advanceRange(advance, entry)}. ` : '') +
      (deposit > 0 ? `Caution reçue : ${formatAmount(deposit * rent)}. ` : '') +
      `Vous recevrez vos quittances sur WhatsApp. Kaza`;
    return (
      <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: c.bg }}>
        <Stack.Screen options={{ title: 'Locataire ajouté', headerLeft: () => null }} />
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
              {firstName.trim()} {lastName.trim()}
            </Text>
            <Text tone="muted" style={{ textAlign: 'center' }}>
              est locataire de {unit.label} · {property.name}
            </Text>
            {advance > 0 ? (
              <Text variant="small" color={status.paid.fg} style={{ textAlign: 'center' }}>
                Avance enregistrée : {advanceRange(advance, entry)} ({formatAmount(advanceTotal)})
              </Text>
            ) : null}
          </View>
          <Button
            label="Envoyer un message de bienvenue"
            icon={MessageCircle}
            onPress={() => openWhatsApp(`+${country.dial}${digits}`, welcome)}
          />
          <Button
            label="Voir la fiche du locataire"
            variant="secondary"
            onPress={() => router.replace({ pathname: '/locataire/[id]', params: { id: createdId } })}
          />
          <Button label="Terminer" variant="ghost" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: 'Nouveau locataire',
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingRight: space.sm }}>
              <X size={20} color={c.primary} />
              <Text variant="body" tone="primary" style={{ fontFamily: fonts.medium }}>
                Annuler
              </Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={{ padding: space.md, gap: space.xl, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled">
        <Section title="Unité louée">
          {!choosingUnit && unit && property ? (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.md,
                  backgroundColor: c.primarySoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <DoorOpen size={22} color={c.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{unit.label}</Text>
                <Text variant="small" tone="muted" numberOfLines={1}>
                  {property.name}
                </Text>
              </View>
              <Button label="Changer" variant="ghost" compact onPress={() => setChoosingUnit(true)} />
            </Card>
          ) : vacant.length === 0 ? (
            <Card padded={false}>
              <EmptyState
                icon={DoorOpen}
                title="Aucune unité vacante"
                body="Toutes vos unités sont louées. Ajoutez des unités depuis la fiche d’un bien."
              />
            </Card>
          ) : (
            <Card padded={false}>
              {properties
                .filter((p) => vacant.some((u) => u.propertyId === p.id))
                .map((p, pi) => (
                  <View key={p.id}>
                    <View
                      style={{
                        paddingHorizontal: space.md,
                        paddingTop: space.sm,
                        paddingBottom: 4,
                        borderTopWidth: pi === 0 ? 0 : 1,
                        borderTopColor: c.border,
                        backgroundColor: c.surfaceAlt,
                      }}>
                      <Text variant="label" tone="muted">
                        {p.name.toUpperCase()}
                      </Text>
                    </View>
                    {vacant
                      .filter((u) => u.propertyId === p.id)
                      .map((u) => {
                        const on = u.id === unitId;
                        return (
                          <Pressable
                            key={u.id}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: on }}
                            onPress={() => chooseUnit(u.id)}
                            style={({ pressed }) => ({
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: space.sm,
                              minHeight: 52,
                              paddingHorizontal: space.md,
                              borderTopWidth: 1,
                              borderTopColor: c.border,
                              backgroundColor: on ? c.primarySoft : pressed ? c.surfaceAlt : 'transparent',
                            })}>
                            <Text variant="bodyStrong" style={{ flex: 1 }}>
                              {u.label}
                            </Text>
                            <Text variant="small" tone="muted" style={{ fontVariant: ['tabular-nums'] }}>
                              {formatNumber(u.rent)} / mois
                            </Text>
                          </Pressable>
                        );
                      })}
                  </View>
                ))}
            </Card>
          )}
          {show(errors.unit) ? (
            <Text variant="small" color={status.late.fg}>
              {errors.unit}
            </Text>
          ) : null}
        </Section>

        <Section title="Locataire">
          {Platform.OS !== 'web' ? (
            <Button label="Importer depuis mes contacts" icon={BookUser} variant="secondary" onPress={importContact} />
          ) : null}
          {contactError ? (
            <Text variant="small" color={status.late.fg}>
              {contactError}
            </Text>
          ) : null}
          <TextField
            label="Prénom"
            icon={UserRound}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Ex. Awa"
            autoCapitalize="words"
            error={show(errors.firstName)}
          />
          <TextField
            label="Nom"
            value={lastName}
            onChangeText={setLastName}
            placeholder="Ex. Koné"
            autoCapitalize="words"
            error={show(errors.lastName)}
          />
          <PhoneField
            label="Téléphone (WhatsApp de préférence)"
            country={country}
            national={national}
            onChange={(ct, n) => {
              setCountry(ct);
              setNational(n);
            }}
            error={show(errors.phone)}
          />
        </Section>

        <Section title="Loyer">
          <TextField
            label="Loyer mensuel"
            value={rent ? formatNumber(rent) : ''}
            onChangeText={(t) => setRent(Number(t.replace(/\D/g, '')) || 0)}
            keyboardType="number-pad"
            placeholder="0"
            suffix="FCFA"
            error={show(errors.rent)}
            helper={
              unit && rent > 0 && rent !== unit.rent
                ? `Le loyer de ${unit.label} passera de ${formatAmount(unit.rent)} à ${formatAmount(rent)}.`
                : undefined
            }
            style={{ fontVariant: ['tabular-nums'] }}
          />
          <DateField
            label="Date d’entrée"
            value={entryDate}
            onChange={setEntryDate}
            min={new Date(today.getFullYear() - 2, today.getMonth(), 1)}
            max={new Date(today.getFullYear(), today.getMonth() + 3, 0)}
            helper={
              rent > 0 && firstMonth.partial
                ? `Premier mois (du ${dayLabel(firstMonth.fromDay)} au ${firstMonth.toDay} ${formatPeriod(entryPeriod).split(' ')[0]}) : ${formatAmount(firstMonth.amount)} au lieu de ${formatAmount(rent)}.`
                : entryPeriod > currentPeriod
                  ? `Aucun loyer ne sera attendu avant ${formatPeriod(entryPeriod)}.`
                  : entryPeriod < currentPeriod
                    ? 'Entrée passée : enregistrez ensuite les loyers déjà reçus depuis cette date.'
                    : undefined
            }
          />
          <View style={{ gap: 6 }}>
            <FieldLabel>Jour de paiement</FieldLabel>
            <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
              {DUE_DAYS.map((d) => (
                <Chip key={d} label={`Le ${d}`} selected={dueDay === d} onPress={() => setDueDay(d)} />
              ))}
            </View>
          </View>
          <View style={{ gap: 6 }}>
            <FieldLabel>Durée du contrat</FieldLabel>
            <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
              {[0, 1, 2, 3].map((n) => (
                <Chip key={n} label={n === 0 ? 'Indéterminée' : `${n} an${n > 1 ? 's' : ''}`} selected={years === n} onPress={() => setYears(n)} />
              ))}
            </View>
            <Text variant="small" tone="muted">
              {years > 0
                ? `Jusqu’au ${formatDate(contractEnd(entryDate, years))}. Kaza vous préviendra avant la fin.`
                : 'Sans date de fin. Vous pourrez en ajouter une depuis la fiche du locataire.'}
            </Text>
          </View>
        </Section>

        <Section title="À l’entrée">
          <View style={{ gap: 6 }}>
            <FieldLabel>Avance payée</FieldLabel>
            <Stepper
              label="Mois d’avance"
              value={advance}
              onChange={setAdvance}
              max={12}
              unit={(n) => (n === 0 ? 'Aucune' : `${n} mois`)}
            />
            <Text variant="small" tone="muted">
              {advance > 0 && rent > 0
                ? `${formatAmount(advanceTotal)}${firstMonth.partial ? ' (premier mois au prorata)' : ` (${advance} × ${formatNumber(rent)})`}, enregistrés comme loyers payés pour ${advanceRange(advance, entry)}.`
                : `Aucune avance : le premier loyer sera attendu en ${formatPeriod(entryPeriod)}.`}
            </Text>
          </View>
          {advance > 0 ? (
            <View style={{ gap: 6 }}>
              <FieldLabel>Avance reçue par</FieldLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
                {methodOrder.map((m) => {
                  const on = m === advanceMethod;
                  return (
                    <Pressable
                      key={m}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      onPress={() => setAdvanceMethod(m)}
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
          <View style={{ gap: 6 }}>
            <FieldLabel>Caution</FieldLabel>
            <Stepper
              label="Mois de caution"
              value={deposit}
              onChange={setDeposit}
              max={6}
              unit={(n) => (n === 0 ? 'Aucune' : `${n} mois`)}
            />
            <Text variant="small" tone="muted">
              {deposit > 0 && rent > 0
                ? `${formatAmount(deposit * rent)}, remboursables au départ. La caution n’entre pas dans les encaissements.`
                : 'Pas de caution.'}
            </Text>
          </View>
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
          gap: 6,
        }}>
        {submitted && !valid ? (
          <Text variant="small" color={status.late.fg} style={{ textAlign: 'center' }}>
            Complétez les champs signalés en rouge.
          </Text>
        ) : null}
        <FormError message={saveError} />
        <Button
          label={saving ? 'Enregistrement…' : 'Ajouter le locataire'}
          icon={Check}
          haptic
          onPress={save}
          disabled={(vacant.length === 0 && !unit) || saving}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
