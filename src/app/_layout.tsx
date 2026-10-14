import { IBMPlexSans_400Regular } from '@expo-google-fonts/ibm-plex-sans/400Regular';
import { IBMPlexSans_500Medium } from '@expo-google-fonts/ibm-plex-sans/500Medium';
import { IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans/600SemiBold';
import { IBMPlexSans_700Bold } from '@expo-google-fonts/ibm-plex-sans/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { StoreProvider, useStore } from '@/data/store';
import { fonts, ThemeProvider, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { c, scheme } = useTheme();
  const { session, onboarded } = useStore();
  const signedIn = !!session;
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: c.bg },
          headerStyle: { backgroundColor: c.bg },
          headerTintColor: c.primary,
          headerTitleStyle: { fontFamily: fonts.semibold, color: c.text },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
        }}>
        {/* Non connecté : accueil et connexion */}
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="bienvenue" options={{ headerShown: false }} />
          <Stack.Screen name="connexion" options={{ title: '' }} />
          <Stack.Screen name="verification" options={{ title: '' }} />
        </Stack.Protected>

        {/* Connecté, profil ou premier bien à renseigner */}
        <Stack.Protected guard={signedIn && !onboarded}>
          <Stack.Screen name="onboarding/profil" options={{ title: '', headerBackVisible: false }} />
          <Stack.Screen name="onboarding/premier-bien" options={{ title: '' }} />
          <Stack.Screen name="onboarding/invitation" options={{ title: '' }} />
        </Stack.Protected>

        {/* Application */}
        <Stack.Protected guard={signedIn && onboarded}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="locataire/[id]/index" options={{ title: 'Locataire' }} />
          <Stack.Screen name="locataire/[id]/depart" options={{ title: 'Départ du locataire', presentation: 'modal' }} />
          <Stack.Screen name="locataire/nouveau" options={{ title: 'Nouveau locataire', presentation: 'modal' }} />
          <Stack.Screen name="encaisser" options={{ title: 'Encaisser un loyer', presentation: 'modal' }} />
          <Stack.Screen name="bien/[id]/index" options={{ headerShown: false }} />
          <Stack.Screen name="bien/[id]/unites" options={{ title: 'Ajouter des unités', presentation: 'modal' }} />
          <Stack.Screen name="quittance/[id]" options={{ title: 'Quittance' }} />
          <Stack.Screen name="parametres" options={{ title: 'Paramètres' }} />
          <Stack.Screen name="equipe" options={{ title: 'Équipe' }} />
          <Stack.Screen name="invitations" options={{ title: 'Invitations' }} />
          <Stack.Screen name="journal" options={{ title: 'Journal d’activité' }} />
          <Stack.Screen name="bien/nouveau" options={{ title: 'Nouveau bien', presentation: 'modal' }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

/** Garde le splash affiché tant que les polices et les données sauvegardées ne sont pas prêtes. */
function Gate({ fontsReady }: { fontsReady: boolean }) {
  const { hydrated } = useStore();
  const ready = fontsReady && hydrated;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  return ready ? <RootStack /> : null;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    [fonts.regular]: IBMPlexSans_400Regular,
    [fonts.medium]: IBMPlexSans_500Medium,
    [fonts.semibold]: IBMPlexSans_600SemiBold,
    [fonts.bold]: IBMPlexSans_700Bold,
  });

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StoreProvider>
          <Gate fontsReady={loaded || !!error} />
        </StoreProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
