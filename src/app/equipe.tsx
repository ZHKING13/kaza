import { Stack } from 'expo-router';
import { Check, Lock, SlidersHorizontal, UserPlus } from 'lucide-react-native';
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
import {
  memberPermissions,
  type Permission,
  permissionLabels,
  permissions,
  presetOf,
  type PermissionPreset,
  rolePresets,
} from '@/data/permissions';
import { remote, type Role, type TeamInvitation, type TeamMember } from '@/data/remote';
import { roleLabels, usePermissions, usePlan, useStore } from '@/data/store';
import { errorMessage } from '@/lib/api';
import { formatDate, formatPhone } from '@/lib/format';
import { radius, space, useTheme } from '@/theme';

const INVITABLE: PermissionPreset[] = ['manager', 'collector', 'viewer'];

const roleHints: Record<PermissionPreset, string> = {
  manager: 'Biens, locataires, encaissements, dépenses, départs. Pas les réglages ni l’équipe.',
  collector: 'Encaisser et relancer. Consulte le reste.',
  viewer: 'Consulte seulement.',
};

/** « Collecteur », ou « Collecteur (personnalisé) » quand les cases ne sont plus celles du modèle */
const accessLabel = (role: Role, list?: Permission[]) =>
  role === 'owner' || !list || presetOf(list) === role ? roleLabels[role] : `${roleLabels[role]} (personnalisé)`;

const sameList = (a: readonly string[], b: readonly string[]) => a.join() === b.join();

const memberName = (m: TeamMember) => `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() || (m.phone ? formatPhone(m.phone) : 'Membre');

/** Équipe de l'espace ouvert : membres, invitations en attente, invitation par numéro (propriétaire). */
export default function Equipe() {
  const { c } = useTheme();
  const { organizationId, organizations, leaveOrganization } = useStore();
  const { isOwner, can } = usePermissions();
  const canAudit = can('activity.view');
  // Cocher chaque permission : offres Famille et Agence ; sinon modèles seulement
  const customizable = usePlan().limits.customPermissions;
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
          Les personnes qui travaillent avec vous dans cet espace. Tout le monde voit les loyers et les retards ; vous
          décidez de ce que chacun peut faire.
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
                      {accessLabel(m.role, m.permissions)}
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
                    <Text variant="small" tone="muted">
                      Modèle (remet ses cases)
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
                      {INVITABLE.map((r) => (
                        <Chip
                          key={r}
                          label={roleLabels[r]}
                          selected={m.role === r}
                          onPress={() => act(() => remote.updateMember(organizationId!, m.userId, { role: r }))}
                        />
                      ))}
                    </View>
                    <MemberPermissions
                      key={(m.permissions ?? []).join()}
                      member={m}
                      locked={!customizable}
                      onSave={(list) => act(() => remote.updateMember(organizationId!, m.userId, { permissions: list }))}
                    />
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
                    {accessLabel(inv.role, inv.permissions)} · valable jusqu’au {formatDate(inv.expiresAt)}
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

      {isOwner && organizationId ? <InviteForm organizationId={organizationId} customizable={customizable} onSent={load} /> : null}

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

/** Cases cochées d'un membre, enregistrées d'un coup */
function MemberPermissions({
  member,
  locked,
  onSave,
}: {
  member: TeamMember;
  locked: boolean;
  onSave: (list: Permission[]) => void;
}) {
  const current = memberPermissions(member.role, member.permissions);
  const [list, setList] = useState<Permission[]>(current);
  const changed = !sameList(list, current);
  return (
    <View style={{ gap: space.xs }}>
      <PermissionChecklist value={list} onChange={setList} locked={locked} />
      {changed ? <Button label="Enregistrer ses permissions" compact onPress={() => onSave(list)} /> : null}
    </View>
  );
}

/** Une case par permission. `locked` : offre gratuite, modèles seulement */
function PermissionChecklist({
  value,
  onChange,
  locked,
}: {
  value: Permission[];
  onChange: (list: Permission[]) => void;
  locked: boolean;
}) {
  const { c } = useTheme();
  const toggle = (p: Permission) => {
    const next = new Set(value);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    onChange(permissions.filter((x) => next.has(x)));
  };
  return (
    <View style={{ gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        {locked ? <Lock size={14} color={c.textMuted} /> : <SlidersHorizontal size={14} color={c.textMuted} />}
        <Text variant="small" tone="muted" style={{ flex: 1 }}>
          {locked ? 'Régler chaque permission : compris dans l’offre Famille' : 'Ce que cette personne peut faire'}
        </Text>
      </View>
      {permissions.map((p) => {
        const on = value.includes(p);
        return (
          <Pressable
            key={p}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on, disabled: locked }}
            accessibilityLabel={permissionLabels[p].label}
            accessibilityHint={permissionLabels[p].hint}
            disabled={locked}
            onPress={() => toggle(p)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 6, opacity: locked ? 0.6 : 1 }}>
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                borderWidth: 2,
                borderColor: on ? c.primary : c.border,
                backgroundColor: on ? c.primary : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              {on ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="small" style={{ fontWeight: '600' }}>
                {permissionLabels[p].label}
              </Text>
              <Text variant="small" tone="muted">
                {permissionLabels[p].hint}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function InviteForm({
  organizationId,
  customizable,
  onSent,
}: {
  organizationId: string;
  customizable: boolean;
  onSent: () => void;
}) {
  const { c } = useTheme();
  const [country, setCountry] = useState<Country>(countries[0]);
  const [national, setNational] = useState('');
  const [role, setRole] = useState<PermissionPreset>('collector');
  /** Cases cochées ; null : celles du modèle */
  const [custom, setCustom] = useState<Permission[] | null>(null);
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
      const ticked = custom && !sameList(custom, rolePresets[role]) ? custom : undefined;
      await remote.invite(organizationId, phone, role, ticked);
      setSent(`Invitation envoyée sur le WhatsApp du ${formatPhone(phone)}. Elle est valable 7 jours.`);
      setNational('');
      setCustom(null);
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
              onPress={() => {
                setRole(r);
                setCustom(null);
              }}
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
      {custom ? (
        <PermissionChecklist value={custom} onChange={setCustom} locked={!customizable} />
      ) : (
        <Button
          label="Personnaliser les permissions"
          icon={SlidersHorizontal}
          variant="ghost"
          compact
          onPress={() => setCustom(rolePresets[role])}
        />
      )}
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
