import { router } from 'expo-router';
import { ChevronRight, Hand, Link2, MessageCircle, RefreshCw, Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Share, View } from 'react-native';

import { Button } from './Button';
import { Card } from './Card';
import { ConfirmSheet } from './ConfirmSheet';
import { FormError } from './FormError';
import { Text } from './Text';
import { usePermissions, useStore } from '@/data/store';
import type { Tenant } from '@/data/types';
import { errorMessage } from '@/lib/api';
import { formatAmount } from '@/lib/format';
import { openWhatsApp } from '@/lib/whatsapp';
import { radius, space, useTheme } from '@/theme';

/**
 * Fiche locataire : son espace personnel (solde, quittances, numéros où payer, « J'ai payé »), le lien à lui
 * envoyer, et les paiements qu'il a signalés. Compte en ligne seulement (la démo le présente sans lien actif).
 */
export function TenantSpace({ tenant }: { tenant: Tenant }) {
  const { c } = useTheme();
  const { remote, mode, declarations, settings, regenerateTenantLink } = useStore();
  const { canManage, canCollect } = usePermissions();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string>();

  if (!remote && mode !== 'demo') return null;
  const pending = declarations.filter((d) => d.tenantId === tenant.id);
  const url = tenant.portalUrl;
  const message = url
    ? `Bonjour ${tenant.firstName}, voici votre espace locataire : ${url} Vous y trouvez votre solde, vos quittances et ` +
      `les numéros pour payer, et vous pouvez me signaler un paiement. Ce lien est personnel.`
    : '';

  return (
    <Card style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        <Link2 size={20} color={c.primary} />
        <Text variant="h3" accessibilityRole="header" style={{ flex: 1 }}>
          Espace locataire
        </Text>
      </View>
      <Text variant="small" tone="muted">
        Dans son espace personnel, votre locataire voit ce qui reste à payer et ses quittances, vous paie directement sur vos
        numéros et vous signale ses paiements. Sans compte ni application.
      </Text>

      {pending.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/declarations')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: c.primarySoft, borderRadius: radius.md, padding: space.sm }}>
          <Hand size={18} color={c.primary} />
          <Text variant="small" tone="primary" style={{ flex: 1, fontWeight: '600' }}>
            {pending.length === 1 ? 'Paiement signalé' : `${pending.length} paiements signalés`} :{' '}
            {formatAmount(pending.reduce((s, d) => s + d.amount, 0))} à confirmer
          </Text>
          <ChevronRight size={18} color={c.primary} />
        </Pressable>
      ) : null}

      {url ? (
        <>
          <Text variant="small" selectable numberOfLines={1} style={{ color: c.primary }}>
            {url}
          </Text>
          {canCollect ? (
            <View style={{ flexDirection: 'row', gap: space.xs }}>
              <Button
                label="WhatsApp"
                icon={MessageCircle}
                variant="secondary"
                compact
                style={{ flex: 1 }}
                onPress={() => openWhatsApp(tenant.phone, message)}
              />
              <Button
                label="Partager"
                icon={Share2}
                variant="secondary"
                compact
                style={{ flex: 1 }}
                onPress={() => Share.share({ message }).catch(() => {})}
              />
            </View>
          ) : null}
          {canManage ? (
            <Button label="Créer un nouveau lien" icon={RefreshCw} variant="ghost" compact onPress={() => setConfirm(true)} />
          ) : null}
        </>
      ) : mode === 'demo' ? (
        <Text variant="small" tone="muted">
          Démo : avec un compte Kaza, chaque locataire reçoit son lien personnel dans ses messages WhatsApp.
        </Text>
      ) : null}

      {canManage && !settings.payoutAccounts?.length ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/paiement-direct')}>
          <Text variant="small" tone="primary" style={{ fontWeight: '600' }}>
            Ajoutez vos numéros Wave ou Mobile Money pour que vos locataires vous paient directement →
          </Text>
        </Pressable>
      ) : null}
      <FormError message={error} />

      <ConfirmSheet
        visible={confirm}
        title="Créer un nouveau lien ?"
        message={`L’ancien lien de ${tenant.firstName} ne fonctionnera plus (utile s’il a été partagé par erreur). Pensez à lui envoyer le nouveau.`}
        confirmLabel="Créer le lien"
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          setError(undefined);
          try {
            await regenerateTenantLink(tenant.id);
          } catch (e) {
            setError(errorMessage(e));
          }
          setConfirm(false);
        }}
      />
    </Card>
  );
}
