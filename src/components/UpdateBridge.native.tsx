import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { RotateCw } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from './Button';
import { Text } from './Text';
import { radius, space, useTheme } from '@/theme';

/** Une vérification au plus toutes les 30 minutes au retour dans l'application */
const CHECK_EVERY_MS = 30 * 60_000;

/** Index « mise à jour importante » d'une version (app.json › extra.updateCriticalIndex, augmenté à la publication). */
function criticalIndex(manifest: unknown): number {
  const m = manifest as { extra?: { expoClient?: { extra?: { updateCriticalIndex?: number } } } } | undefined;
  return Number(m?.extra?.expoClient?.extra?.updateCriticalIndex ?? 0);
}

/**
 * Mises à jour sans passer par les stores (EAS Update). Au démarrage, expo-updates télécharge la nouvelle version
 * en arrière-plan ; elle s'applique au démarrage suivant, sans rien demander. On vérifie aussi au retour dans
 * l'application. Une version marquée importante (index plus grand que celui en cours) propose de redémarrer tout de suite.
 */
export function UpdateBridge() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [critical, setCritical] = useState(false);
  const lastCheck = useRef(0);

  useEffect(() => {
    if (!Updates.isEnabled || __DEV__) return;
    const current = criticalIndex(Updates.manifest) || Number(Constants.expoConfig?.extra?.updateCriticalIndex ?? 0);
    const check = async () => {
      if (Date.now() - lastCheck.current < CHECK_EVERY_MS) return;
      lastCheck.current = Date.now();
      try {
        const { isAvailable } = await Updates.checkForUpdateAsync();
        if (!isAvailable) return;
        const result = await Updates.fetchUpdateAsync();
        if (result.isNew && criticalIndex(result.manifest) > current) setCritical(true);
      } catch {
        // Pas de réseau : nouvel essai au prochain retour dans l'application
      }
    };
    void check();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void check());
    return () => sub.remove();
  }, []);

  if (!critical) return null;
  return (
    <View
      style={{
        position: 'absolute',
        left: space.md,
        right: space.md,
        bottom: insets.bottom + 72,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        padding: space.sm,
        paddingLeft: space.md,
        borderRadius: radius.md,
        backgroundColor: c.text,
      }}>
      <Text variant="small" color={c.bg} style={{ flex: 1 }}>
        Nouvelle version de Kaza prête : une correction importante.
      </Text>
      <Button label="Redémarrer" icon={RotateCw} compact onPress={() => void Updates.reloadAsync()} />
    </View>
  );
}
