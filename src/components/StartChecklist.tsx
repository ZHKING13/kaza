import { type Href, router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { View } from 'react-native';

import { usePermissions, useStore } from '@/data/store';
import { radius, space, useTheme } from '@/theme';

import { Button } from './Button';
import { Card } from './Card';
import { Text } from './Text';

type Step = { done: boolean; title: string; hint: string; action: string; href: Href };

/** Les 3 étapes pour commencer, cochées automatiquement. Disparaît quand tout est fait. */
export function StartChecklist() {
  const { c } = useTheme();
  const { properties, tenants, payments, mode } = useStore();
  // Créer biens et locataires : propriétaire et gérant
  const { canManage } = usePermissions();
  const steps: Step[] = [
    {
      done: properties.length > 0,
      title: 'Ajouter un bien',
      hint: 'Une cour, une villa, un immeuble…',
      action: 'Ajouter un bien',
      href: '/bien/nouveau',
    },
    {
      done: tenants.length > 0,
      title: 'Ajouter vos locataires',
      hint: 'Nom, téléphone, loyer et avance de chaque locataire.',
      action: 'Ajouter un locataire',
      href: '/locataire/nouveau',
    },
    {
      done: payments.length > 0,
      title: 'Encaisser un premier loyer',
      hint: 'Kaza prépare la quittance à envoyer sur WhatsApp.',
      action: 'Encaisser un loyer',
      href: '/encaisser',
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (mode === 'demo' || !canManage || doneCount === steps.length) return null;
  const current = steps.findIndex((s) => !s.done);

  return (
    <Card style={{ gap: space.md, borderColor: c.primary, borderWidth: 1.5 }}>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text variant="h3" accessibilityRole="header">
            Pour bien démarrer
          </Text>
          <Text variant="small" tone="muted">
            {doneCount} / {steps.length}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {steps.map((s, i) => (
            <View
              key={i}
              style={{ flex: 1, height: 4, borderRadius: radius.full, backgroundColor: s.done ? c.primary : c.border }}
            />
          ))}
        </View>
      </View>
      {steps.map((s, i) => {
        const isCurrent = i === current;
        return (
          <View
            key={s.title}
            style={{ flexDirection: 'row', gap: space.sm }}
            accessibilityLabel={`${s.title} : ${s.done ? 'fait' : 'à faire'}`}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: radius.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: s.done ? c.primary : 'transparent',
                borderWidth: s.done ? 0 : 2,
                borderColor: isCurrent ? c.primary : c.border,
              }}>
              {s.done ? (
                <Check size={16} color={c.onPrimary} strokeWidth={3} />
              ) : (
                <Text variant="label" color={isCurrent ? c.primary : c.textMuted}>
                  {i + 1}
                </Text>
              )}
            </View>
            <View style={{ flex: 1, gap: 2, paddingTop: 3 }}>
              <Text
                variant="bodyStrong"
                color={s.done ? c.textMuted : c.text}
                style={s.done ? { textDecorationLine: 'line-through' } : undefined}>
                {s.title}
              </Text>
              {isCurrent ? (
                <>
                  <Text variant="small" tone="muted">
                    {s.hint}
                  </Text>
                  <Button
                    label={s.action}
                    compact
                    style={{ alignSelf: 'flex-start', marginTop: space.xs }}
                    onPress={() => router.push(s.href)}
                  />
                </>
              ) : null}
            </View>
          </View>
        );
      })}
    </Card>
  );
}
