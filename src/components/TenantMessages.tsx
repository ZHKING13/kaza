import { Card } from './Card';
import { Text } from './Text';
import { View } from 'react-native';

import { messageKindLabels, messageStatusLabels } from '@/data/messages';
import type { TenantMessage } from '@/data/remote';
import { formatDate } from '@/lib/format';
import { space, useTheme } from '@/theme';

/** Derniers messages envoyés au locataire par Kaza. */
export function TenantMessages({ messages, error }: { messages: TenantMessage[] | null; error?: string }) {
  const { c, status } = useTheme();
  if (!messages && !error) return null;

  return (
    <>
      <Text variant="h3" accessibilityRole="header">
        Messages envoyés
      </Text>
      <Card style={{ paddingVertical: space.xxs }}>
        {error ? (
          <Text variant="small" tone="muted" style={{ paddingVertical: space.sm }}>
            {error}
          </Text>
        ) : messages!.length === 0 ? (
          <Text variant="small" tone="muted" style={{ paddingVertical: space.sm }}>
            Aucun message envoyé par Kaza pour l’instant.
          </Text>
        ) : (
          messages!.slice(0, 8).map((m, i) => {
            const failed = m.status === 'failed';
            return (
              <View
                key={m.id}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: space.sm,
                  paddingVertical: space.sm,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: c.border,
                }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyStrong">{messageKindLabels[m.kind]}</Text>
                  <Text variant="caption" tone="muted">
                    {formatDate(m.sentAt ?? m.createdAt)}
                    {m.channel ? ` · ${m.channel === 'sms' ? 'SMS' : 'WhatsApp'}` : ''}
                    {m.error && (failed || m.status === 'cancelled') ? ` · ${m.error}` : ''}
                  </Text>
                </View>
                <Text variant="small" color={failed ? status.late.fg : m.status === 'read' || m.status === 'delivered' ? status.paid.fg : c.textMuted}>
                  {messageStatusLabels[m.status]}
                </Text>
              </View>
            );
          })
        )}
      </Card>
    </>
  );
}
