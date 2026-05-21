import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '@/components/layout/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/theme/use-colors';
import { PriceAlert, UserContribution, useApp } from '@/context/AppContext';
import { STATIONS } from '@/data/stations';
import { startOAuthLogin } from '@/constants/oauth';
import * as Haptics from 'expo-haptics';

export default function LoginScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useApp();
  const [loading, setLoading] = useState<'google' | 'facebook' | 'demo' | null>(null);
  const [error, setError] = useState('');

  // Redireciona para o app se o usuário já estiver logado
  useEffect(() => {
    if (state.user) {
      router.replace('/(tabs)');
    }
  }, [state.user]);

  const handleOAuthLogin = async (provider: 'google' | 'facebook') => {
    setLoading(provider);
    setError('');
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await startOAuthLogin(provider);
      // startOAuthLogin redirects away or opens a web browser,
      // the callback will be handled by app/oauth/callback.tsx
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha no login com o provedor selecionado.';
      setError(message);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(null);
    }
  };

  const handleDemoLogin = () => {
    setLoading('demo');
    setError('');
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const demoStations = STATIONS.slice(0, 5);
    const demoAlerts: PriceAlert[] = demoStations.slice(0, 2).map((station, index) => ({
      id: `demo-alert-${station.id}`,
      fuelType: index === 0 ? 'gasolina' : 'etanol',
      maxPrice: index === 0 ? 6.05 : 4.35,
      stationId: station.id,
      active: true,
      createdAt: new Date(Date.now() - (index + 1) * 60 * 60 * 1000),
    }));
    const demoContributions: UserContribution[] = demoStations.slice(0, 4).map((station, index) => {
      const fuelType = index % 2 === 0 ? 'gasolina' : 'etanol';
      const currentPrice = station.prices.find((price) => price.type === fuelType)?.price ?? 6;
      return {
        stationId: station.id,
        fuelType,
        price: Number((currentPrice - 0.03).toFixed(2)),
        date: new Date(Date.now() - (index + 2) * 45 * 60 * 1000),
      };
    });

    dispatch({
      type: 'HYDRATE',
      state: {
        user: {
          id: 0,
        name: 'Usuário Demonstração',
          email: 'demo@abastece.local',
          openId: 'demo-local',
        },
        favoriteIds: demoStations.slice(0, 3).map((station) => station.id),
        alerts: demoAlerts,
        contributions: demoContributions,
        comparatorIds: demoStations.slice(0, 2).map((station) => station.id),
      },
    });
    router.replace('/(tabs)');
  };

  return (
    <ScreenContainer
      containerClassName="bg-background"
      edges={['top', 'left', 'right', 'bottom']}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo and branding */}
        <View style={styles.header}>
          <Text style={{ fontSize: 56 }}>⛽</Text>
          <Text style={[styles.appName, { color: colors.foreground }]}>Abastece Manaus</Text>
          <Text style={[styles.appTagline, { color: colors.muted }]}>
            Encontre o combustível mais barato em Manaus
          </Text>
        </View>

        {/* Benefits */}
        <View style={[styles.benefitsBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <BenefitRow icon="🗺️" text="Mapa interativo com preços em tempo real" colors={colors} />
          <BenefitRow icon="💰" text="Compare preços entre postos" colors={colors} />
          <BenefitRow icon="🤝" text="Contribua com preços e ajude a comunidade" colors={colors} />
          <BenefitRow icon="🔔" text="Receba alertas quando o preço baixar" colors={colors} />
        </View>

        {/* Error message */}
        {error ? (
          <View style={[styles.errorBox, { backgroundColor: colors.error + '20', borderColor: colors.error }]}>
            <IconSymbol name="exclamationmark.circle.fill" size={16} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        ) : null}

        {/* Login buttons */}
        <View style={styles.buttonContainer}>
          <Text style={[styles.loginTitle, { color: colors.foreground }]}>Faça login com</Text>

          <Pressable
            onPress={handleDemoLogin}
            disabled={loading !== null}
            style={({ pressed }) => [
              styles.demoButton,
              {
                backgroundColor: colors.primary,
                opacity: pressed || loading !== null ? 0.82 : 1,
              },
            ]}
          >
            {loading === 'demo' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <IconSymbol name="shield.fill" size={18} color="#fff" />
                <Text style={styles.demoButtonText}>Entrar em modo demonstração</Text>
              </>
            )}
          </Pressable>

          {/* Google button */}
          <Pressable
            onPress={() => handleOAuthLogin('google')}
            disabled={loading !== null}
            style={({ pressed }) => [
              styles.oauthButton,
              {
                backgroundColor: '#fff',
                borderColor: '#DADCE0',
                opacity: pressed || loading !== null ? 0.75 : 1,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.08,
                shadowRadius: 3,
                elevation: 2,
              },
            ]}
          >
            {loading === 'google' ? (
              <ActivityIndicator size="small" color="#4285F4" />
            ) : (
              <>
                {/* Google "G" colorido */}
                <Text style={styles.googleIcon}>G</Text>
                <Text style={[styles.oauthButtonText, { color: '#3C4043' }]}>
                  Continuar com Google
                </Text>
              </>
            )}
          </Pressable>

          {/* Facebook button */}
          <Pressable
            onPress={() => handleOAuthLogin('facebook')}
            disabled={loading !== null}
            style={({ pressed }) => [
              styles.oauthButton,
              {
                backgroundColor: '#1877F2',
                borderColor: '#1877F2',
                opacity: pressed || loading !== null ? 0.75 : 1,
              },
            ]}
          >
            {loading === 'facebook' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Text style={styles.facebookIcon}>f</Text>
                <Text style={[styles.oauthButtonText, { color: '#fff' }]}>
                  Continuar com Facebook
                </Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Privacy note */}
        <View style={styles.privacyBox}>
          <Text style={[styles.privacyText, { color: colors.muted }]}>
            Seus dados são protegidos. Usamos OAuth para segurança máxima. Você controla suas informações.
          </Text>
        </View>

      </ScrollView>
    </ScreenContainer>
  );
}

function BenefitRow({ icon, text, colors }: { icon: string; text: string; colors: any }) {
  return (
    <View style={styles.benefitRow}>
      <Text style={{ fontSize: 18, lineHeight: 24 }}>{icon}</Text>
      <Text style={[styles.benefitText, { color: colors.foreground }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    gap: 24,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    gap: 10,
  },
  appName: {
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 38,
    textAlign: 'center',
  },
  appTagline: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  benefitsBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  buttonContainer: {
    gap: 12,
  },
  loginTitle: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 21,
    textAlign: 'center',
  },
  oauthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 15,
    borderRadius: 14,
  },
  demoButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21,
  },
  oauthButtonText: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 21,
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4285F4',
    lineHeight: 24,
    fontStyle: 'italic',
  },
  facebookIcon: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 26,
  },
  privacyBox: {
    padding: 4,
  },
  privacyText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
