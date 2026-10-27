import { router } from 'expo-router';
import { Check, Hand, X } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Linking, Pressable, ScrollView, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { EmptyState } from '@/components/EmptyState';
import { MethodDot } from '@/components/MethodDot';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { methods } from '@/data/methods';
import { usePermissions, useStore, useTenantSummaries } from '@/data/store';
import type { PaymentDeclaration } from '@/data/types';
import { formatAmount, formatDate } from '@/lib/format';
import { radius, space, useTheme } from '@/theme';

const REJECT_REASONS = ['Rien reçu sur mon numéro', 'Montant différent', 'Paiement déjà enregistré'];

/** Paiement signalé par un locataire depuis son espace : vérifier qu'on a reçu l'argent, puis encaisser ou refuser. */
function DeclarationCard({ d, onReject }: { d: PaymentDeclaration; onReject: () => void }) {
  const { c } = useTheme();
  const { can } = usePermissions();
  const canCollect = can('payments.record');
  const summary = useTenantSummaries().find((s) => s.tenant.id === d.tenantId);
  const name = summary ? `${summary.tenant.firstName} ${summary.tenant.lastName}` : 'Ancien locataire';
  return (
    <Card style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        {summary ? <Avatar first={summary.tenant.firstName} last={summary.tenant.lastName} size={44} /> : null}
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{name}</Text>
          {summary ? (
            <Text variant="small" tone="muted">
              {summary.unit.label} · {summary.property.name}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={{ gap: 4 }}>
        <Text variant="h2" style={{ fontVariant: ['tabular-nums'] }}>
          {formatAmount(d.amount)}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <MethodDot method={d.method} size={10} />
          <Text tone="muted">
            {methods[d.method].label} · payé le {formatDate(d.paidOn)}
          </Text>
        </View>
        {d.reference ? <Text variant="small">Référence : {d.reference}</Text> : null}
        {d.note ? (
          <Text variant="small" tone="muted">
            « {d.note} »
          </Text>
        ) : null}
      </View>
      {d.proofUrl ? (
        <Pressable
          accessibilityRole="imagebutton"
          accessibilityLabel="Ouvrir la capture d’écran envoyée par le locataire"
          onPress={() => Linking.openURL(d.proofUrl!)}>
          <Image
            source={{ uri: d.proofUrl }}
            style={{ width: '100%', height: 180, borderRadius: radius.md, backgroundColor: c.surfaceAlt }}
            resizeMode="contain"
          />
        </Pressable>
      ) : null}
      {canCollect && summary ? (
        <View style={{ flexDirection: 'row', gap: space.xs }}>
          <Button label="Refuser" icon={X} variant="secondary" style={{ flex: 1 }} onPress={onReject} />
          <Button
            label="Encaisser"
            icon={Check}
            style={{ flex: 1 }}
            onPress={() =>
              router.push({
                pathname: '/encaisser',
                params: { tenantId: d.tenantId, declarationId: d.id },
              })
            }
          />
        </View>
      ) : null}
    </Card>
  );
}

export default function Declarations() {
  const { c } = useTheme();
  const { declarations, rejectDeclaration } = useStore();
  const [rejecting, setRejecting] = useState<PaymentDeclaration | null>(null);
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const [other, setOther] = useState('');
  const sorted = [...declarations].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xxl }}>
      {sorted.length === 0 ? (
        <EmptyState
          icon={Hand}
          title="Rien à confirmer"
          body="Quand un locataire signale un paiement depuis son espace, il apparaît ici pour que vous l’encaissiez."
        />
      ) : (
        <>
          <Text tone="muted">
            Vérifiez sur votre téléphone que l’argent est bien arrivé, puis encaissez : la quittance part comme d’habitude.
          </Text>
          {sorted.map((d) => (
            <DeclarationCard
              key={d.id}
              d={d}
              onReject={() => {
                setReason(REJECT_REASONS[0]);
                setOther('');
                setRejecting(d);
              }}
            />
          ))}
        </>
      )}
      <ConfirmSheet
        visible={!!rejecting}
        title="Refuser ce paiement ?"
        message="Le locataire verra le motif dans son espace et pourra vous recontacter."
        confirmLabel="Refuser le paiement"
        cancelLabel="Retour"
        onClose={() => setRejecting(null)}
        onConfirm={async () => {
          if (!rejecting) return;
          await rejectDeclaration(rejecting.id, reason === 'Autre' ? other.trim() || 'Paiement non reçu' : reason);
          setRejecting(null);
        }}>
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
          {[...REJECT_REASONS, 'Autre'].map((r) => (
            <Chip key={r} label={r} selected={reason === r} onPress={() => setReason(r)} />
          ))}
        </View>
        {reason === 'Autre' ? <TextField label="Motif" value={other} onChangeText={setOther} maxLength={200} /> : null}
      </ConfirmSheet>
    </ScrollView>
  );
}
