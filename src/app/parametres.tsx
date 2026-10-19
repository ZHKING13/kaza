import { Stack } from 'expo-router';
import { BellRing, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Switch, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { FormError } from '@/components/FormError';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { type ProrataRule, prorataRules, rentForPeriod } from '@/data/prorata';
import { type AccountDeletionPreview, type MessagingSettings, remote } from '@/data/remote';
import { defaultLeaseSettings, type LeaseSettings } from '@/data/rent';
import { usePermissions, useStore } from '@/data/store';
import { errorMessage } from '@/lib/api';
import { formatAmount, formatPeriod, periodOf } from '@/lib/format';
import { type PushCategory, type PushPermission, type PushSettings, pushApi, pushPermission, registerForPush } from '@/lib/push';
import { radius, space, useTheme } from '@/theme';

const ORDER: ProrataRule[] = ['full', 'daily', 'half'];

export default function Parametres() {
  const { c } = useTheme();
  const { settings, setSettings, today, remote, syncedAt } = useStore();
  const [error, setError] = useState<string>();
  const { isOwner } = usePermissions();
  const choose = (prorata: ProrataRule) => {
    if (!isOwner) return;
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
      {remote ? <NotificationsSection /> : null}
      {!isOwner ? (
        <Text variant="small" tone="muted" style={{ backgroundColor: c.surfaceAlt, borderRadius: radius.md, padding: space.sm }}>
          Seul le propriétaire de l’espace peut modifier ces réglages.
        </Text>
      ) : null}
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
              accessibilityState={{ checked: on, disabled: !isOwner }}
              disabled={!isOwner}
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

      {settings.messaging ? <MessagingSection value={settings.messaging} readOnly={!isOwner} /> : null}

      <LeasesSection value={settings.leases ?? defaultLeaseSettings} readOnly={!isOwner} />

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
      {remote ? <DeleteAccountSection /> : null}
    </ScrollView>
  );
}

/** Suppression du compte (exigée par Google Play et l'App Store) : ce qui part, puis confirmation tapée. */
function DeleteAccountSection() {
  const { c, status } = useTheme();
  const { signOut } = useStore();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<AccountDeletionPreview | null>(null);
  const [typed, setTyped] = useState('');
  const [loadError, setLoadError] = useState<string>();

  const start = async () => {
    setTyped('');
    setLoadError(undefined);
    setOpen(true);
    try {
      setPreview(await remote.deletionPreview());
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  };
  const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

  return (
    <View style={{ gap: space.xs, marginTop: space.lg, paddingTop: space.md, borderTopWidth: 1, borderTopColor: c.border }}>
      <Text variant="h3" accessibilityRole="header">
        Supprimer mon compte
      </Text>
      <Text variant="small" tone="muted">
        Efface votre profil et les espaces dont vous êtes propriétaire, avec leurs biens, locataires, paiements et photos. C’est
        définitif.
      </Text>
      <Button label="Supprimer mon compte" icon={Trash2} variant="ghost" onPress={start} style={{ alignSelf: 'flex-start' }} />
      <ConfirmSheet
        visible={open}
        title="Supprimer votre compte ?"
        message="Cette action est définitive : rien ne pourra être récupéré."
        confirmLabel="Supprimer définitivement"
        icon={Trash2}
        onClose={() => setOpen(false)}
        onConfirm={async () => {
          if (typed.trim().toUpperCase() !== 'SUPPRIMER') throw new Error('Tapez SUPPRIMER pour confirmer.');
          await remote.deleteAccount();
          // Le serveur a fermé les sessions : on efface ce téléphone et on revient à l'accueil
          signOut();
        }}>
        {loadError ? <FormError message={loadError} /> : null}
        {preview ? (
          <View style={{ gap: space.xs }}>
            {preview.owned.map((o) => (
              <Text key={o.id} variant="small" color={status.late.fg}>
                • {o.name} : {plural(o.units, 'logement')}, {plural(o.tenants, 'locataire')} supprimés
                {o.otherMembers ? ` ; ${plural(o.otherMembers, 'membre')} de l’équipe perdront l’accès` : ''}.
              </Text>
            ))}
            {preview.memberOf.map((o) => (
              <Text key={o.id} variant="small" tone="muted">
                • Vous quittez {o.name} (ses données restent à son propriétaire).
              </Text>
            ))}
          </View>
        ) : !loadError ? (
          <Text variant="small" tone="muted">
            Chargement…
          </Text>
        ) : null}
        <TextField
          label="Tapez SUPPRIMER pour confirmer"
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="SUPPRIMER"
        />
      </ConfirmSheet>
    </View>
  );
}

const PUSH_ROWS: { key: PushCategory; title: string; hint: string }[] = [
  { key: 'payments', title: 'Paiements reçus', hint: 'Un locataire a payé par mobile money.' },
  { key: 'late', title: 'Loyers en retard', hint: 'Un récapitulatif à 9 h, les jours où des loyers restent dus.' },
  { key: 'lease', title: 'Fins de contrat et préavis', hint: '30 jours avant, 7 jours avant et le jour même.' },
  { key: 'subscription', title: 'Mon offre', hint: 'Paiement confirmé, offre de bienvenue ou offre bientôt terminées.' },
  { key: 'team', title: 'Équipe', hint: 'Une personne invitée a rejoint l’espace.' },
  { key: 'teamPayments', title: 'Encaissements de l’équipe', hint: 'Chaque loyer saisi par un gérant ou un collecteur.' },
];

/** Notifications push de l'utilisateur (tous ses espaces, tous ses téléphones) ; état de l'autorisation sur ce téléphone. */
function NotificationsSection() {
  const { c } = useTheme();
  const [value, setValue] = useState<PushSettings | null>(null);
  const [permission, setPermission] = useState<PushPermission>('unsupported');
  const [error, setError] = useState<string>();

  useEffect(() => {
    let alive = true;
    pushApi
      .settings()
      .then((v) => alive && setValue(v))
      .catch((e) => alive && setError(errorMessage(e)));
    pushPermission()
      .then((p) => alive && setPermission(p))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const toggle = (key: PushCategory, on: boolean) => {
    if (!value) return;
    const before = value;
    setError(undefined);
    setValue({ ...value, [key]: on });
    pushApi
      .update({ [key]: on })
      .then(setValue)
      .catch((e) => {
        setValue(before);
        setError(errorMessage(e));
      });
  };
  const enable = async () => {
    setError(undefined);
    try {
      const result = await registerForPush(true);
      setPermission(result);
      setValue(await pushApi.settings());
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const phoneState =
    permission === 'denied' ? (
      <View style={{ gap: space.xs, padding: space.md, borderRadius: radius.md, backgroundColor: c.surfaceAlt }}>
        <Text variant="small">Les notifications de Kaza sont bloquées sur ce téléphone.</Text>
        <Button label="Ouvrir les réglages du téléphone" variant="secondary" compact onPress={() => Linking.openSettings()} />
      </View>
    ) : permission === 'undetermined' ? (
      <Button label="Activer sur ce téléphone" icon={BellRing} compact onPress={enable} />
    ) : value && value.devices === 0 ? (
      <Text variant="small" tone="muted" style={{ backgroundColor: c.surfaceAlt, borderRadius: radius.md, padding: space.sm }}>
        Aucun téléphone ne reçoit encore vos notifications : ouvrez Kaza sur votre téléphone et acceptez-les.
      </Text>
    ) : null;

  return (
    <View style={{ gap: space.xs }}>
      <View style={{ gap: 4, marginBottom: space.xxs }}>
        <Text variant="h3" accessibilityRole="header">
          Mes notifications
        </Text>
        <Text variant="small" tone="muted">
          Sur votre téléphone, pour tous vos espaces, selon votre rôle dans chacun.
          {value && value.devices > 0 ? ` ${value.devices > 1 ? `${value.devices} téléphones les reçoivent.` : '1 téléphone les reçoit.'}` : ''}
        </Text>
      </View>
      {phoneState}
      {value
        ? PUSH_ROWS.map((row) => (
            <View
              key={row.key}
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
                <Text variant="bodyStrong">{row.title}</Text>
                <Text variant="small" tone="muted">
                  {row.hint}
                </Text>
              </View>
              <Switch
                accessibilityLabel={row.title}
                value={value[row.key]}
                onValueChange={(on) => toggle(row.key, on)}
                trackColor={{ true: c.primary, false: c.border }}
                thumbColor={c.surface}
              />
            </View>
          ))
        : null}
      <FormError message={error} />
    </View>
  );
}

const DAYS_BEFORE = [0, 1, 3, 5];

/** Compte en ligne : ce que Kaza envoie aux locataires par WhatsApp (repli SMS). */
function MessagingSection({ value, readOnly }: { value: MessagingSettings; readOnly: boolean }) {
  const { c } = useTheme();
  const { setSettings } = useStore();
  const [error, setError] = useState<string>();
  const change = (messaging: Partial<MessagingSettings>) => {
    if (readOnly) return;
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
        disabled={readOnly}
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

/** Préavis par défaut et alertes de l'accueil (« Fin de contrat proche », « Révision de loyer »). */
function LeasesSection({ value, readOnly }: { value: LeaseSettings; readOnly: boolean }) {
  const { setSettings } = useStore();
  const [error, setError] = useState<string>();
  const change = (leases: Partial<LeaseSettings>) => {
    if (readOnly) return;
    setError(undefined);
    setSettings({ leases: { ...value, ...leases } }).catch((e) => setError(errorMessage(e)));
  };
  const chips = <T extends number>(label: string, options: T[], selected: number, text: (n: T) => string, onPick: (n: T) => void) => (
    <View style={{ gap: space.xs, paddingHorizontal: space.xxs }}>
      <Text variant="small" tone="muted">
        {label}
      </Text>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
        {options.map((n) => (
          <Chip key={n} label={text(n)} selected={selected === n} onPress={() => onPick(n)} />
        ))}
      </View>
    </View>
  );
  const months = (n: number) => (n === 0 ? 'Aucun' : `${n} mois`);

  return (
    <View style={{ gap: space.sm, marginTop: space.md }}>
      <View style={{ gap: 4 }}>
        <Text variant="h3" accessibilityRole="header">
          Préavis et alertes
        </Text>
        <Text variant="small" tone="muted">
          Durées proposées quand vous enregistrez un préavis (vérifiez celles de votre contrat et de la loi de votre pays),
          et alertes affichées sur l’accueil.
        </Text>
      </View>
      {chips('Préavis quand le locataire part', [1, 2, 3], value.noticeTenantMonths, months, (n) => change({ noticeTenantMonths: n }))}
      {chips('Préavis quand le bailleur met fin au bail', [1, 3, 6], value.noticeLandlordMonths, months, (n) =>
        change({ noticeLandlordMonths: n }),
      )}
      {chips('Alerte « Fin de contrat proche »', [30, 60, 90], value.leaseEndAlertDays, (n) => `${n} jours avant`, (n) =>
        change({ leaseEndAlertDays: n }),
      )}
      {chips(
        'Alerte « Révision de loyer »',
        [0, 12, 24, 36],
        value.rentRevisionAlertMonths,
        (n) => (n === 0 ? 'Désactivée' : `Après ${n / 12} an${n > 12 ? 's' : ''} sans changement`),
        (n) => change({ rentRevisionAlertMonths: n }),
      )}
      <FormError message={error} />
    </View>
  );
}
