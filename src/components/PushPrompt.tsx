import AsyncStorage from '@react-native-async-storage/async-storage';
import { BellRing, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from './Button';
import { Text } from './Text';
import { useStore } from '@/data/store';
import { pushPermission, registerForPush } from '@/lib/push';
import { radius, space, useTheme } from '@/theme';

const DISMISSED_KEY = 'kaza.pushPromptDismissed';

/**
 * Accueil, compte en ligne : propose d'activer les notifications tant que le téléphone ne les a ni autorisées ni refusées.
 * « Plus tard » la masque ; Paramètres › Notifications permet de les activer ensuite.
 */
export function PushPrompt() {
  const { c } = useTheme();
  const { remote } = useStore();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!remote) return;
    let alive = true;
    Promise.all([pushPermission(), AsyncStorage.getItem(DISMISSED_KEY).catch(() => null)])
      .then(([permission, dismissed]) => alive && setVisible(permission === 'undetermined' && !dismissed))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [remote]);

  if (!visible) return null;
  const dismiss = () => {
    setVisible(false);
    AsyncStorage.setItem(DISMISSED_KEY, new Date().toISOString()).catch(() => {});
  };
  const enable = async () => {
    setBusy(true);
    try {
      await registerForPush(true);
    } catch {
      // Réessayé au prochain démarrage
    } finally {
      setBusy(false);
      setVisible(false);
    }
  };

  return (
    <View style={{ borderRadius: radius.md, padding: space.md, gap: space.sm, backgroundColor: c.primarySoft }}>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <BellRing size={20} color={c.primary} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong">Soyez prévenu sans ouvrir l’application</Text>
          <Text variant="small" tone="muted">
            Paiements reçus par mobile money, loyers en retard chaque matin, fins de contrat et nouvelles de votre équipe.
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Plus tard" hitSlop={8} onPress={dismiss}>
          <X size={18} color={c.textMuted} />
        </Pressable>
      </View>
      <Button label={busy ? 'Activation…' : 'Activer les notifications'} icon={BellRing} compact disabled={busy} onPress={enable} />
    </View>
  );
}
