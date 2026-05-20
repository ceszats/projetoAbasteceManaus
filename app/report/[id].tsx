import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/theme/use-colors';
import { useApp } from '@/context/AppContext';
import { STATIONS, FuelType, FUEL_TYPE_LABELS, FUEL_TYPE_ICONS } from '@/data/stations';
import { trpc } from '@/lib/trpc';
import * as Haptics from 'expo-haptics';

const FUEL_TYPES: FuelType[] = ['gasolina', 'aditivada', 'etanol', 'diesel', 'gnv'];

export default function ReportPriceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { state, dispatch } = useApp();

  const station = STATIONS.find(s => s.id === id);
  const [selectedFuel, setSelectedFuel] = useState<FuelType>('gasolina');
  const [priceInput, setPriceInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const addContribution = trpc.contributions.add.useMutation({
    onSuccess: (_, variables) => {
      dispatch({ type: 'REPORT_PRICE', stationId: id as string, fuelType: selectedFuel, price: Number(variables.price) });
      setSubmitted(true);
    },
    onError: (err) => {
      setError(err.message);
    }
  });

  if (!station) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground }}>Posto não encontrado</Text>
      </View>
    );
  }

  const existingPrice = station.prices.find(p => p.type === selectedFuel);

  const handleSubmit = () => {
    const price = parseFloat(priceInput.replace(',', '.'));
    if (isNaN(price) || price < 1 || price > 20) {
      setError('Insira um preço válido entre R$ 1,00 e R$ 20,00');
      return;
    }
    setError('');
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    addContribution.mutate({
      stationId: id as string,
      fuelType: selectedFuel,
      price: price
    });
  };

  if (submitted) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.successContainer, { paddingTop: insets.top + 20 }]}>
          <View style={[styles.successIcon, { backgroundColor: colors.primary + '20' }]}>
            <Text style={{ fontSize: 48 }}>✅</Text>
          </View>
          <Text style={[styles.successTitle, { color: colors.foreground }]}>
            Obrigado pela contribuição!
          </Text>
          <Text style={[styles.successSub, { color: colors.muted }]}>
            Você reportou {FUEL_TYPE_LABELS[selectedFuel]} a R$ {parseFloat(priceInput.replace(',', '.')).toFixed(2)}/L no {station.name}.
          </Text>
          <Text style={[styles.successNote, { color: colors.muted }]}>
            Sua contribuição ajuda outros motoristas de Manaus a economizar combustível! 🌿
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.doneBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.doneBtnText}>Voltar ao posto</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <IconSymbol name="xmark" size={20} color={colors.muted} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Reportar Preço</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        {/* Station info */}
        <View style={[styles.stationInfo, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <IconSymbol name="fuelpump.fill" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.stationName, { color: colors.foreground }]}>{station.name}</Text>
            <Text style={[styles.stationAddr, { color: colors.muted }]}>{station.neighborhood}</Text>
          </View>
        </View>

        {/* Fuel type selection */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Tipo de Combustível</Text>
        <View style={styles.fuelGrid}>
          {FUEL_TYPES.map(type => {
            const isSelected = type === selectedFuel;
            return (
              <Pressable
                key={type}
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedFuel(type);
                }}
                style={({ pressed }) => [
                  styles.fuelOption,
                  {
                    backgroundColor: isSelected ? colors.primary + '15' : colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={{ fontSize: 24, lineHeight: 30 }}>{FUEL_TYPE_ICONS[type]}</Text>
                <Text style={[styles.fuelOptionText, { color: isSelected ? colors.primary : colors.foreground }]}>
                  {FUEL_TYPE_LABELS[type]}
                </Text>
                {existingPrice && type === selectedFuel && (
                  <Text style={[styles.currentPrice, { color: colors.muted }]}>
                    Atual: R$ {existingPrice.price.toFixed(2)}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Price input */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Preço por Litro</Text>
        <View style={[styles.priceInputContainer, { backgroundColor: colors.surface, borderColor: error ? colors.error : colors.border }]}>
          <Text style={[styles.currencySymbol, { color: colors.muted }]}>R$</Text>
          <TextInput
            style={[styles.priceInput, { color: colors.foreground }]}
            placeholder="0,00"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            value={priceInput}
            onChangeText={v => { setPriceInput(v); setError(''); }}
            returnKeyType="done"
          />
          <Text style={[styles.perLiter, { color: colors.muted }]}>/litro</Text>
        </View>
        {error ? (
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        ) : null}

        {/* Tip */}
        <View style={[styles.tipBox, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
          <Text style={{ fontSize: 16 }}>💡</Text>
          <Text style={[styles.tipText, { color: colors.muted }]}>
            Confirme o preço diretamente na bomba antes de reportar. Sua contribuição ajuda motoristas de Manaus!
          </Text>
        </View>

        {/* Submit */}
        <Pressable
          onPress={handleSubmit}
          style={({ pressed }) => [
            styles.submitBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <IconSymbol name="checkmark.circle.fill" size={20} color="#fff" />
          <Text style={styles.submitBtnText}>Confirmar Preço</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center',
  },
  content: {
    padding: 16,
    gap: 4,
  },
  stationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  stationName: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  stationAddr: {
    fontSize: 12,
    lineHeight: 17,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 12,
    marginBottom: 10,
  },
  fuelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fuelOption: {
    flexBasis: '30%',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 4,
    flexGrow: 1,
    minWidth: 96,
  },
  fuelOptionText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
  },
  currentPrice: {
    fontSize: 10,
    lineHeight: 14,
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
    marginBottom: 4,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
  },
  priceInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
    padding: 0,
  },
  perLiter: {
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  tipBox: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    alignItems: 'flex-start',
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 16,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  // Success state
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    textAlign: 'center',
  },
  successSub: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  successNote: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  doneBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 8,
  },
  doneBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
});
