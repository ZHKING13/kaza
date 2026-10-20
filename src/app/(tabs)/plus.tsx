import {
  Stamp,
  Building2,
  ChevronRight,
  Crown,
  FileText,
  History,
  LifeBuoy,
  LogOut,
  type LucideIcon,
  MailOpen,
  Settings,
  UsersRound,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { router } from 'expo-router';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { DemoBanner } from '@/components/DemoBanner';
import { Card } from '@/components/Card';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { KazaMark } from '@/components/KazaMark';
import { Screen } from '@/components/Screen';
import { SyncBanner } from '@/components/SyncBanner';
import { Text } from '@/components/Text';
import { prorataRules } from '@/data/prorata';
import { type OrganizationSubscription, plans } from '@/data/plans';
import { roleLabels, usePermissions, usePlan, useStore } from '@/data/store';
import { errorMessage } from '@/lib/api';
import { FormError } from '@/components/FormError';
import { createAccountFromDemo, demoSignupLabel } from '@/lib/demo';
import { formatDate, formatPhone } from '@/lib/format';
import { radius, space, useTheme } from '@/theme';

function Row({
  icon: Icon,
  label,
  hint,
  first,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  first?: boolean;
  onPress?: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        minHeight: 56,
        paddingHorizontal: space.md,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: c.border,
        backgroundColor: pressed ? c.surfaceAlt : 'transparent',
      })}>
      <Icon size={22} color={c.textMuted} />
      <Text style={{ flex: 1 }}>{label}</Text>
      {hint ? (
        <Text variant="small" tone="muted">
          {hint}
        </Text>
      ) : null}
      <ChevronRight size={20} color={c.textMuted} />
    </Pressable>
  );
}

function offerHint(s: OrganizationSubscription): string {
  if (s.status === 'trial') return `Essai gratuit jusqu’au ${formatDate(s.endsAt!)} · voir les offres`;
  if (s.status === 'active') return `Jusqu’au ${formatDate(s.endsAt!)} · prolonger ou changer`;
  if (s.status === 'grace') return `À renouveler avant le ${formatDate(s.endsAt!)}`;
  return 'Voir les offres payantes';
}

export default function Plus() {
  const { c } = useTheme();
  const { settings, profile, mode, session, signOut, outbox, remote, organizations, organizationId, invitations, switchOrganization, identity } =
    useStore();
  const { role, canAudit } = usePermissions();
  const plan = usePlan();
  const [confirmOut, setConfirmOut] = useState(false);
  const [switchError, setSwitchError] = useState<string>();
  const current = organizations.find((o) => o.id === organizationId);
  return (
    <Screen title="Plus">
      {mode === 'demo' ? (
        <DemoBanner action={{ label: demoSignupLabel, onPress: () => createAccountFromDemo(signOut) }}>
          Vous explorez la démo : les biens et locataires sont fictifs.
        </DemoBanner>
      ) : null}
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Avatar first={profile.firstName} last={profile.lastName} size={52} />
        <View style={{ flex: 1 }}>
          <Text variant="h3">
            {profile.firstName} {profile.lastName}
          </Text>
          <Text variant="small" tone="muted">
            {profile.phone ? formatPhone(profile.phone) : session?.email}
          </Text>
          {session && session.provider !== 'demo' ? (
            <Text variant="caption" tone="muted">
              Connecté avec {session.provider === 'phone' ? 'votre numéro' : session.provider === 'google' ? 'Google' : 'Apple'}
            </Text>
          ) : null}
        </View>
      </Card>

      {plan.subscription ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/offre')}
          style={({ pressed }) => ({
            backgroundColor: pressed ? c.surfaceAlt : c.surface,
            borderColor: c.accent,
            borderWidth: 1,
            borderRadius: radius.md,
            padding: space.md,
            flexDirection: 'row',
            gap: space.sm,
            alignItems: 'center',
          })}>
          <Crown size={24} color={c.accent} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">
              Offre {plans[plan.subscription.effectivePlan].label}
              {plan.subscription.status === 'trial' ? ' (essai)' : ''} · {plan.unitsUsed}
              {plan.limits.units === null ? '' : ` logement${plan.unitsUsed > 1 ? 's' : ''} sur ${plan.limits.units}`}
            </Text>
            <Text variant="small" tone="muted">
              {offerHint(plan.subscription)}
            </Text>
          </View>
          <ChevronRight size={20} color={c.textMuted} />
        </Pressable>
      ) : null}

      {remote && current ? (
        <Card padded={false}>
          {organizations.map((o, i) => (
            <Row
              key={o.id}
              icon={Building2}
              label={o.name}
              hint={o.id === organizationId ? `${roleLabels[o.role]} · ouvert` : roleLabels[o.role]}
              first={i === 0}
              onPress={
                o.id === organizationId
                  ? undefined
                  : () => {
                      setSwitchError(undefined);
                      switchOrganization(o.id).catch((e) => setSwitchError(errorMessage(e)));
                    }
              }
            />
          ))}
          {invitations.length > 0 ? (
            <Row icon={MailOpen} label={`Invitations reçues (${invitations.length})`} onPress={() => router.push('/invitations')} />
          ) : null}
        </Card>
      ) : null}
      <FormError message={switchError} />

      <Card padded={false}>
        <Row
          icon={UsersRound}
          label="Équipe et gérants"
          hint={remote ? roleLabels[role] : undefined}
          first
          onPress={remote ? () => router.push('/equipe') : undefined}
        />
        {remote && canAudit ? <Row icon={History} label="Journal d’activité" onPress={() => router.push('/journal')} /> : null}
        <Row
          icon={Stamp}
          label="Identité et quittances"
          hint={identity.legalName ?? undefined}
          onPress={() => router.push('/identite')}
        />
        <Row icon={FileText} label="Rapports et exports" onPress={() => router.push('/rapports')} />
        <Row
          icon={Settings}
          label="Paramètres"
          hint={prorataRules[settings.prorata].label}
          onPress={() => router.push('/parametres')}
        />
        <Row icon={LifeBuoy} label="Aide sur WhatsApp" />
      </Card>

      <SyncBanner />

      <Button
        label={mode === 'demo' ? 'Quitter la démo' : 'Se déconnecter'}
        icon={LogOut}
        variant="danger"
        onPress={() => setConfirmOut(true)}
      />
      <ConfirmSheet
        visible={confirmOut}
        title={mode === 'demo' ? 'Quitter la démo ?' : 'Se déconnecter ?'}
        message={
          mode === 'demo'
            ? 'Les données d’exemple seront effacées et vous reviendrez à l’écran d’accueil.'
            : outbox.length
              ? `Attention : ${outbox.length} enregistrement${outbox.length > 1 ? 's' : ''} pas encore envoyé${outbox.length > 1 ? 's' : ''} au serveur ${outbox.length > 1 ? 'seront perdus' : 'sera perdu'}. Reconnectez-vous au réseau avant de vous déconnecter.`
              : remote
                ? 'Vos données restent sur votre compte : vous les retrouverez en vous reconnectant.'
                : 'Vos biens, locataires et paiements enregistrés sur ce téléphone seront effacés.'
        }
        confirmLabel={mode === 'demo' ? 'Quitter la démo' : 'Se déconnecter'}
        icon={LogOut}
        onClose={() => setConfirmOut(false)}
        onConfirm={signOut}
      />

      <View style={{ alignItems: 'center', gap: space.xs, paddingTop: space.lg }}>
        <KazaMark size={28} />
        <Text variant="caption" tone="muted">
          Kaza 0.1.0 · Le loyer, sans courir.
        </Text>
      </View>
    </Screen>
  );
}
