import { router } from 'expo-router';
import { FileText, type LucideIcon, MessageCircle, Smartphone } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { KazaMark } from '@/components/KazaMark';
import { KazaWordmark } from '@/components/KazaWordmark';
import { Text } from '@/components/Text';
import { useStore } from '@/data/store';
import { isWebDemo } from '@/lib/demo';
import { fonts, radius, space, useTheme } from '@/theme';

function Point({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: radius.md,
          backgroundColor: c.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon size={22} color={c.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="small" tone="muted">
          {body}
        </Text>
      </View>
    </View>
  );
}

export default function Bienvenue() {
  const { c } = useTheme();
  const { startDemo } = useStore();
  // Démo du site vitrine : pas d'écran d'accueil, on entre directement dans la démo
  useEffect(() => {
    if (isWebDemo) startDemo();
  }, [startDemo]);
  if (isWebDemo) return null;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: space.lg, gap: space.xl, justifyContent: 'space-between' }}>
        <View style={{ gap: space.xl, paddingTop: space.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <KazaMark size={52} />
            <KazaWordmark height={40} />
          </View>
          <Text variant="h1" style={{ fontSize: 30, lineHeight: 38 }} accessibilityRole="header">
            Vos loyers rentrent.{'\n'}Vous restez tranquille.
          </Text>
          <View style={{ gap: space.lg }}>
            <Point
              icon={Smartphone}
              title="Encaissez sans vous déplacer"
              body="Orange Money, MTN, Wave, Moov ou espèces : chaque paiement est noté et daté."
            />
            <Point
              icon={MessageCircle}
              title="Relancez sur WhatsApp"
              body="Un message prêt à envoyer pour chaque retard, en un tap."
            />
            <Point
              icon={FileText}
              title="Quittances automatiques"
              body="En PDF, partagées au locataire dès que le loyer est payé."
            />
          </View>
        </View>
        <View style={{ gap: space.sm, paddingBottom: space.sm }}>
          <Button label="Créer mon compte" haptic onPress={() => router.push('/connexion')} />
          <Button label="Explorer la démo" variant="secondary" onPress={startDemo} />
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/connexion')}
            style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}>
            <Text variant="small" tone="muted">
              Déjà un compte ?{' '}
              <Text variant="small" tone="primary" style={{ fontFamily: fonts.semibold }}>
                Se connecter
              </Text>
            </Text>
          </Pressable>
          <Text variant="caption" tone="muted" style={{ textAlign: 'center' }}>
            La démo utilise des biens et des locataires fictifs à Abidjan.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
