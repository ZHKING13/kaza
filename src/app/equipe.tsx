import { Stack } from 'expo-router';
import { UserPlus } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { FormError } from '@/components/FormError';
import { PhoneField } from '@/components/PhoneField';
import { Text } from '@/components/Text';
import { countries, type Country } from '@/data/countries';
import { remote, type Role, type TeamInvitation, type TeamMember } from '@/data/remote';
import { roleLabels, usePermissions, useStore } from '@/data/store';
import { errorMessage } from '@/lib/api';
import { formatDate, formatPhone } from '@/lib/format';
import { radius, space, useTheme } from '@/theme';

const INVITABLE: Role[] = ['manager', 'collector', 'viewer'];

const roleHints: Record<Role, string> = {
  owner: 'Tous les droits.',
  manager: 'Biens, locataires, encaissements, départs. Pas les paramètres ni l’équipe.',
  collector: 'Encaisser et relancer. Consulte le reste.',
  viewer: 'Consulte seulement.',
};

const memberName = (m: TeamMember) => `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() || (m.phone ? formatPhone(m.phone) : 'Membre');

/** Équipe de l'espace ouvert : membres, invitations en attente, invitation par numéro (propriétaire). */
export default function Equipe() {
  const { c } = useTheme();
  const { organizationId, organizations, leaveOrganization } = useStore();
  const { isOwner, canAudit } = usePermissions();
  const organization = organizations.find((o) => o.id === organizationId);

  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [error, setError] = useState<string>();
  const [open, setOpen] = useState<string | null>(null);
  /** Action à confirmer (retirer un membre, annuler une invitation, quitter l'espace) */
  const [ask, setAsk] = useState<{ title: string; message: string; label: string; run: () => Promise<unknown> } | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    try {
      const [m, i] = await Promise.all([
        remote.members(organizationId),
        canAudit ? remote.invitations(organizationId) : Promise.resolve([] as TeamInvitation[]),
      ]);
      setMembers(m);
      setInvitations(i);
      setError(undefined);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [organizationId, canAudit]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (run: () => Promise<unknown>) => {
    setError(undefined);
    try {
      await run();
      await load();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const me = members?.find((m) => m.isMe);

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xxl }}>
      <Stack.Screen options={{ title: 'Équipe' }} />
      <View style={{ gap: 4 }}>
        <Text variant="h3" accessibilityRole="header">
          {organization?.name ?? 'Votre espace'}
        </Text>
        <Text variant="small" tone="muted">
          Les personnes qui travaillent avec vous dans cet espace. Chacune ne voit et ne fait que ce que son rôle permet.
        </Text>
      </View>

      {members ? (
        <Card padded={false}>
          {members.map((m, i) => {
            const editable = isOwner && !m.isMe && m.role !== 'owner';
            return (
              <View key={m.userId} style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.border }}>
                <Pressable
                  accessibilityRole={editable ? 'button' : undefined}
                  disabled={!editable}
                  onPress={() => setOpen(open === m.userId ? null : m.userId)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md }}>
                  <Avatar first={m.firstName ?? ''} last={m.lastName ?? ''} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">
                      {memberName(m)}
                      {m.isMe ? ' (vous)' : ''}
                    </Text>
                    <Text variant="small" tone="muted">
                      {roleLabels[m.role]}
                      {m.phone && (m.firstName || m.lastName) ? ` · ${formatPhone(m.phone)}` : ''}
                    </Text>
                  </View>
                  {editable ? (
                    <Text variant="small" tone="primary">
                      {open === m.userId ? 'Fermer' : 'Modifier'}
                    </Text>
                  ) : null}
                </Pressable>
                {editable && open === m.userId ? (
                  <View style={{ paddingHorizontal: space.md, paddingBottom: space.md, gap: space.sm }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
                      {INVITABLE.map((r) => (
                        <Chip
                          key={r}
                          label={roleLabels[r]}
                          selected={m.role === r}
                          onPress={() => act(() => remote.changeRole(organizationId!, m.userId, r))}
                        />
                      ))}
                    </View>
                    <Button
                      label="Retirer de l’espace"
                      variant="ghost"
                      compact
                      onPress={() =>
                        setAsk({
                          title: `Retirer ${[m.firstName, m.lastName].filter(Boolean).join(' ') || 'ce membre'} ?`,
                          message: 'Cette personne n’aura plus accès aux biens et locataires de l’espace. Vous pourrez l’inviter de nouveau.',
                          label: 'Retirer de l’espace',
                          run: async () => {
                            await remote.removeMember(organizationId!, m.userId);
                            await load();
                          },
                        })
                      }
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
        </Card>
      ) : null}

      {canAudit && invitations.length > 0 ? (
        <>
          <Text variant="h3" accessibilityRole="header">
            Invitations en attente
          </Text>
          <Card padded={false}>
            {invitations.map((inv, i) => (
              <View
                key={inv.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.sm,
                  padding: space.md,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: c.border,
                }}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{formatPhone(inv.phone)}</Text>
                  <Text variant="small" tone="muted">
                    {roleLabels[inv.role]} · valable jusqu’au {formatDate(inv.expiresAt)}
                  </Text>
                </View>
                {isOwner ? (
                  <Button
                    label="Annuler"
                    variant="ghost"
                    compact
                    onPress={() =>
                      setAsk({
                        title: 'Annuler cette invitation ?',
                        message: `${formatPhone(inv.phone)} ne pourra plus rejoindre l’espace avec cette invitation.`,
                        label: 'Annuler l’invitation',
                        run: async () => {
                          await remote.revokeInvitation(organizationId!, inv.id);
                          await load();
                        },
                      })
                    }
                  />
                ) : null}
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {isOwner && organizationId ? <InviteForm organizationId={organizationId} onSent={load} /> : null}

      <FormError message={error} />

      {me && me.role !== 'owner' ? (
        <Button
          label="Quitter cet espace"
          variant="ghost"
          onPress={() =>
            setAsk({
              title: `Quitter « ${organization?.name} » ?`,
              message: 'Vous n’aurez plus accès à ses biens et locataires. Il faudra une nouvelle invitation pour revenir.',
              label: 'Quitter l’espace',
              run: () => leaveOrganization(me.userId),
            })
          }
        />
      ) : null}

      <ConfirmSheet
        visible={!!ask}
        title={ask?.title ?? ''}
        message={ask?.message}
        confirmLabel={ask?.label ?? ''}
        onClose={() => setAsk(null)}
        onConfirm={async () => {
          await ask?.run();
        }}
      />
    </ScrollView>
  );
}

function InviteForm({ organizationId, onSent }: { organizationId: string; onSent: () => void }) {
  const { c } = useTheme();
  const [country, setCountry] = useState<Country>(countries[0]);
  const [national, setNational] = useState('');
  const [role, setRole] = useState<Role>('collector');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string>();
  const [error, setError] = useState<string>();
  const digits = national.replace(/\D/g, '');

  const send = async () => {
    if (digits.length !== country.length) {
      setError(`Un numéro en ${country.name} compte ${country.length} chiffres.`);
      return;
    }
    setSending(true);
    setError(undefined);
    setSent(undefined);
    try {
      const phone = `+${country.dial}${digits}`;
      await remote.invite(organizationId, phone, role);
      setSent(`Invitation envoyée sur le WhatsApp du ${formatPhone(phone)}. Elle est valable 7 jours.`);
      setNational('');
      onSent();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <Card style={{ gap: space.sm }}>
      <Text variant="h3" accessibilityRole="header">
        Inviter quelqu’un
      </Text>
      <PhoneField
        label="Son numéro (WhatsApp)"
        country={country}
        national={national}
        onChange={(ct, n) => {
          setCountry(ct);
          setNational(n);
        }}
      />
      <Text variant="small" tone="muted">
        Rôle
      </Text>
      <View accessibilityRole="radiogroup" style={{ gap: space.xs }}>
        {INVITABLE.map((r) => {
          const on = role === r;
          return (
            <Pressable
              key={r}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={roleLabels[r]}
              onPress={() => setRole(r)}
              style={{
                padding: space.sm,
                borderRadius: radius.md,
                borderWidth: on ? 2 : 1,
                borderColor: on ? c.primary : c.border,
                backgroundColor: on ? c.primarySoft : c.surface,
              }}>
              <Text variant="bodyStrong" color={on ? c.primary : c.text}>
                {roleLabels[r]}
              </Text>
              <Text variant="small" tone="muted">
                {roleHints[r]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Button label={sending ? 'Envoi…' : 'Envoyer l’invitation'} icon={UserPlus} disabled={sending} onPress={send} />
      {sent ? (
        <Text variant="small" tone="primary" accessibilityRole="alert">
          {sent}
        </Text>
      ) : null}
      <FormError message={error} />
    </Card>
  );
}
