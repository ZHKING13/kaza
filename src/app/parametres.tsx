import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { FormError } from '@/components/FormError';
import { Text } from '@/components/Text';
import { type ProrataRule, prorataRules, rentForPeriod } from '@/data/prorata';
import type { MessagingSettings } from '@/data/remote';
import { useStore } from '@/data/store';
import { errorMessage } from '@/lib/api';
import { formatAmount, formatPeriod, periodOf } from '@/lib/format';
import { radius, space, useTheme } from '@/theme';

const ORDER: ProrataRule[] = ['full', 'daily', 'half'];

export default function Parametres() {
  const { c } = useTheme();
  const { settings, setSettings, today, remote, syncedAt } = useStore();
  const [error, setError] = useState<string>();
  const choose = (prorata: ProrataRule) => {
    setError(undefined);
    setSettings({ prorata }).catch((e) => setError(errorMessage(e)));
  };
  // Exemple concret : entrée le 20 du mois en cours, loyer de 120 000
  const period = periodOf(today);
  const entry = new Date(today.getFullYear(), today.getMonth(), 20, 12).toISOString();
  const month = formatPeriod(period).split(' ')[0];

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: space.md, gap: space.md }}>
      <Stack.Screen options={{ title: 'Paramètres' }} />
      <View style={{ gap: 4 }}>
        <Text variant="h3" accessibilityRole="header">
          Mois d’entrée et de départ
        </Text>
        <Text variant="small" tone="muted">
          Comment calculer le loyer quand le locataire n’occupe pas le mois entier. La règle s’applique à l’avance, au solde de
          départ et aux impayés.
        </Text>
      </View>
      <View accessibilityRole="radiogroup" style={{ gap: space.xs }}>
        {ORDER.map((r) => {
          const on = settings.prorata === r;
          const ex = rentForPeriod(120000, period, r, entry).amount;
          return (
            <Pressable
              key={r}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => choose(r)}
              style={{
                flexDirection: 'row',
                gap: space.sm,
                padding: space.md,
                borderRadius: radius.md,
                borderWidth: on ? 2 : 1,
                borderColor: on ? c.primary : c.border,
                backgroundColor: on ? c.primarySoft : c.surface,
              }}>
              <View
                style={{
                  width: 22,
                  height: 22,
                  marginTop: 2,
                  borderRadius: 11,
                  borderWidth: 2,
                  borderColor: on ? c.primary : c.textDisabled,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary }} /> : null}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong" color={on ? c.primary : c.text}>
                  {prorataRules[r].label}
                </Text>
                <Text variant="small" tone="muted">
                  {prorataRules[r].hint}
                </Text>
                <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
                  Ex. : entrée le 20 {month}, loyer 120 000 → {formatAmount(ex)} pour {month}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <FormError message={error} />

      {settings.messaging ? <MessagingSection value={settings.messaging} /> : null}

      <View style={{ gap: 4, marginTop: space.md }}>
        <Text variant="h3" accessibilityRole="header">
          Données
        </Text>
        <Text variant="small" tone="muted">
          {remote
            ? `Vos biens, locataires et paiements sont enregistrés sur votre compte Kaza : vous les retrouvez en vous connectant sur un autre téléphone.${
                syncedAt ? ` Dernière mise à jour : ${new Date(syncedAt).toLocaleString('fr-FR')}.` : ''
              }`
            : 'Vos biens, locataires et paiements sont enregistrés sur ce téléphone. Tant que la synchronisation n’est pas activée, ils ne sont pas récupérables sur un autre appareil.'}
        </Text>
      </View>
    </ScrollView>
  );
}

const DAYS_BEFORE = [0, 1, 3, 5];

/** Compte en ligne : ce que Kaza envoie aux locataires par WhatsApp (repli SMS). */
function MessagingSection({ value }: { value: MessagingSettings }) {
  const { c } = useTheme();
  const { setSettings } = useStore();
  const [error, setError] = useState<string>();
  const change = (messaging: Partial<MessagingSettings>) => {
    setError(undefined);
    setSettings({ messaging: { ...value, ...messaging } }).catch((e) => setError(errorMessage(e)));
  };

  const row = (title: string, hint: string, on: boolean, onChange: (v: boolean) => void) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        padding: space.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.surface,
      }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="small" tone="muted">
          {hint}
        </Text>
      </View>
      <Switch
        accessibilityLabel={title}
        value={on}
        onValueChange={onChange}
        trackColor={{ true: c.primary, false: c.border }}
        thumbColor={c.surface}
      />
    </View>
  );

  return (
    <View style={{ gap: space.xs, marginTop: space.md }}>
      <View style={{ gap: 4, marginBottom: space.xxs }}>
        <Text variant="h3" accessibilityRole="header">
          Messages aux locataires
        </Text>
        <Text variant="small" tone="muted">
          Kaza les envoie sur le WhatsApp du locataire, ou par SMS si WhatsApp ne passe pas, entre 8 h et 20 h.
        </Text>
      </View>
      {row(
        'Relances automatiques',
        value.reminderLateRepeatDays > 0
          ? `Le lendemain de l’échéance si le loyer n’est pas réglé, puis tous les ${value.reminderLateRepeatDays} jours (${value.reminderLateMax} fois au plus).`
          : 'Le lendemain de l’échéance si le loyer n’est pas réglé.',
        value.remindersEnabled,
        (remindersEnabled) => change({ remindersEnabled }),
      )}
      {value.remindersEnabled ? (
        <View style={{ gap: space.xs, paddingHorizontal: space.xxs }}>
          <Text variant="small" tone="muted">
            Rappel avant l’échéance
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            {DAYS_BEFORE.map((d) => (
              <Chip
                key={d}
                label={d === 0 ? 'Aucun' : d === 1 ? 'La veille' : `${d} jours avant`}
                selected={value.reminderDaysBefore === d}
                onPress={() => change({ reminderDaysBefore: d })}
              />
            ))}
          </View>
        </View>
      ) : null}
      {row(
        'Quittances et messages automatiques',
        'La quittance en PDF après chaque encaissement, un message de bienvenue à l’entrée et le solde de tout compte au départ.',
        value.autoMessagesEnabled,
        (autoMessagesEnabled) => change({ autoMessagesEnabled }),
      )}
      <FormError message={error} />
    </View>
  );
}
