import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Modal,
  TextInput,
  Platform,
  Switch,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '@/components/layout/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { GamificationBadge } from '@/components/gamification/GamificationBadge';
import { useTheme } from '@/hooks/theme/use-theme';
import { trpc } from '@/lib/trpc';
import { useApp, PriceAlert } from '@/context/AppContext';
import { FuelType, FUEL_TYPE_LABELS, FUEL_TYPE_ICONS, STATIONS, stationMatchesSearch } from '@/data/stations';
import { useColorScheme } from '@/hooks/theme/use-color-scheme';
import { useThemeContext } from '@/lib/theme-provider';

import * as Haptics from 'expo-haptics';

const FUEL_TYPES: FuelType[] = ['gasolina', 'aditivada', 'etanol', 'diesel', 'gnv'];

export default function ProfileScreen() {
  const { colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useApp();
  const { setColorScheme } = useThemeContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [showNewAlert, setShowNewAlert] = useState(false);
  const [alertFuel, setAlertFuel] = useState<FuelType>('gasolina');
  const [alertPrice, setAlertPrice] = useState('');
  const [alertStationId, setAlertStationId] = useState<string | undefined>(undefined);
  const [alertError, setAlertError] = useState('');
  // busca de posto no modal de alerta
  const [stationSearch, setStationSearch] = useState('');
  const [showStationPicker, setShowStationPicker] = useState(false);

  const contributions = state.contributions;
  const alerts = state.alerts;

  // Busca reputação real do servidor
  const { data: reputation } = trpc.user.reputation.useQuery(undefined, {
    enabled: !!state.user
  });

  // Postos para o picker de alerta — favoritos primeiro
  const stationsForAlertPicker = useMemo(() => {
    const matched = state.stations.filter(s => stationMatchesSearch(s, stationSearch));
    return matched.sort((a, b) => {
      const aFav = state.favoriteIds.includes(a.id) ? 0 : 1;
      const bFav = state.favoriteIds.includes(b.id) ? 0 : 1;
      return aFav - bFav;
    });
  }, [stationSearch, state.stations, state.favoriteIds]);

  const selectedAlertStation = alertStationId ? (state.stations.find(s => s.id === alertStationId) ?? STATIONS.find(s => s.id === alertStationId)) : null;

  const handleCreateAlert = () => {
    const price = parseFloat(alertPrice.replace(',', '.'));
    if (isNaN(price) || price < 1 || price > 20) {
      setAlertError('Insira um preço válido entre R$ 1,00 e R$ 20,00');
      return;
    }
    const alert: PriceAlert = {
      id: Date.now().toString(),
      fuelType: alertFuel,
      maxPrice: price,
      stationId: alertStationId,
      active: true,
      createdAt: new Date(),
    };
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    dispatch({ type: 'ADD_ALERT', alert });
    setShowNewAlert(false);
    setAlertPrice('');
    setAlertFuel('gasolina');
    setAlertStationId(undefined);
    setAlertError('');
    setStationSearch('');
    setShowStationPicker(false);
  };

  const handleToggleAlert = (id: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dispatch({ type: 'TOGGLE_ALERT', alertId: id });
  };

  const handleDeleteAlert = (id: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    dispatch({ type: 'DELETE_ALERT', alertId: id });
  };

  const handleToggleTheme = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setColorScheme(isDark ? 'light' : 'dark');
  };

  return (
    <ScreenContainer containerClassName="bg-background" edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        {/* Profile header */}
        <View style={[
          styles.profileCard,
          {
            backgroundColor: colors.surface,
            borderRadius: tokens.radius.lg,
            ...tokens.shadows.medium,
          }
        ]}>
          {/* Faixa decorativa de cor */}
          <View style={[styles.profileCardAccent, { backgroundColor: colors.primary }]} />

          <View style={styles.profileCardInner}>
            {/* Avatar com ring */}
            <View style={[styles.avatarRing, { borderColor: colors.primary + '40' }]}>
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>🚗</Text>
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.profileName, { color: colors.foreground }]}>
                {state.user?.name ?? 'Motorista Manauara'}
              </Text>
              <Text style={[styles.profileSub, { color: colors.muted }]}>Contribuidor Abastece Manaus</Text>
              {reputation && (
                <View style={{ marginTop: 6 }}>
                  <GamificationBadge 
                    totalContributions={reputation.total} 
                    confirmedContributions={reputation.confirmed}
                    hideLabel={false}
                  />
                </View>
              )}
            </View>

            <View style={[styles.contributionBadge, { backgroundColor: colors.primary + '15' }]}>
              <Text style={[styles.contributionCount, { color: colors.primary }]}>{contributions.length}</Text>
              <Text style={[styles.contributionLabel, { color: colors.primary }]}>contribuições</Text>
            </View>
          </View>
        </View>

        {/* Alertas de preço */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Alertas de Preço</Text>
            <Pressable
              onPress={() => setShowNewAlert(true)}
              style={({ pressed }) => [
                styles.addBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <IconSymbol name="plus.circle.fill" size={14} color="#fff" />
              <Text style={styles.addBtnText}>Novo</Text>
            </Pressable>
          </View>

          {alerts.length === 0 ? (
            <View style={[styles.emptyAlerts, { backgroundColor: colors.surface, borderRadius: tokens.radius.md, ...tokens.shadows.soft }]}>
              <Text style={{ fontSize: 32 }}>🔔</Text>
              <Text style={[styles.emptyAlertsText, { color: colors.muted }]}>
                Nenhum alerta criado. Crie um alerta para ser notificado quando o preço baixar.
              </Text>
            </View>
          ) : (
            alerts.map(alert => {
              const station = alert.stationId ? (state.stations.find(s => s.id === alert.stationId) ?? STATIONS.find(s => s.id === alert.stationId)) : null;
              return (
                <View
                  key={alert.id}
                  style={[styles.alertCard, { backgroundColor: colors.surface, borderRadius: tokens.radius.md, ...tokens.shadows.soft }]}
                >
                  <View style={[styles.alertIcon, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={{ fontSize: 18 }}>{FUEL_TYPE_ICONS[alert.fuelType]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.alertTitle, { color: colors.foreground }]}>
                      {FUEL_TYPE_LABELS[alert.fuelType]} abaixo de R$ {alert.maxPrice.toFixed(2)}
                    </Text>
                    <Text style={[styles.alertSub, { color: colors.muted }]}>
                      {station ? station.name : 'Qualquer posto em Manaus'}
                    </Text>
                  </View>
                  <Switch
                    value={alert.active}
                    onValueChange={() => handleToggleAlert(alert.id)}
                    trackColor={{ false: colors.border, true: colors.primary + '80' }}
                    thumbColor={alert.active ? colors.primary : colors.muted}
                  />
                  <Pressable
                    onPress={() => handleDeleteAlert(alert.id)}
                    style={({ pressed }) => [styles.deleteBtn, { opacity: pressed ? 0.6 : 1 }]}
                  >
                    <IconSymbol name="trash.fill" size={16} color={colors.error} />
                  </Pressable>
                </View>
              );
            })
          )}
        </View>

        {/* Contribuições recentes */}
        {contributions.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Contribuições Recentes</Text>
            {contributions.slice(0, 5).map((c, i) => {
              const station = state.stations.find(s => s.id === c.stationId) ?? STATIONS.find(s => s.id === c.stationId);
              return (
                <View
                  key={i}
                  style={[styles.contributionCard, { backgroundColor: colors.surface, borderRadius: tokens.radius.sm, ...tokens.shadows.soft }]}
                >
                  <Text style={{ fontSize: 18 }}>{FUEL_TYPE_ICONS[c.fuelType]}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.contribStation, { color: colors.foreground }]}>
                      {station?.name ?? 'Posto desconhecido'}
                    </Text>
                    <Text style={[styles.contribDetails, { color: colors.muted }]}>
                      {FUEL_TYPE_LABELS[c.fuelType]} · R$ {c.price.toFixed(2)}/L
                    </Text>
                  </View>
                  <View style={[styles.contribBadge, { backgroundColor: colors.success + '20' }]}>
                    <IconSymbol name="checkmark.circle.fill" size={14} color={colors.success} />
                    <Text style={[styles.contribBadgeText, { color: colors.success }]}>Reportado</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Configurações */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Configurações</Text>
          <View style={[styles.settingsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Tema */}
            <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={{ fontSize: 16 }}>{isDark ? '🌙' : '☀️'}</Text>
                </View>
                <View>
                  <Text style={[styles.settingLabel, { color: colors.foreground }]}>Tema</Text>
                  <Text style={[styles.settingValue, { color: colors.muted }]}>
                    {isDark ? 'Escuro' : 'Claro'}
                  </Text>
                </View>
              </View>
              <Switch
                value={isDark}
                onValueChange={handleToggleTheme}
                trackColor={{ false: colors.border, true: colors.primary + '80' }}
                thumbColor={isDark ? colors.primary : colors.muted}
              />
            </View>

            {/* Sobre */}
            <View style={[styles.settingRow, { borderBottomWidth: 0.5, borderBottomColor: colors.border }]}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={{ fontSize: 16 }}>🌿</Text>
                </View>
                <View>
                  <Text style={[styles.settingLabel, { color: colors.foreground }]}>Abastece Manaus</Text>
                  <Text style={[styles.settingValue, { color: colors.muted }]}>Versão 1.0.0 · AmazoniaTech</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Impacto ambiental */}
        <View style={[styles.ecoCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
          <Text style={{ fontSize: 24 }}>🌱</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.ecoTitle, { color: colors.foreground }]}>Impacto AmazoniaTech</Text>
            <Text style={[styles.ecoText, { color: colors.muted }]}>
              Ao usar o Abastece Manaus, você ajuda a reduzir emissões de CO₂ em Manaus, incentiva combustíveis mais limpos e contribui com dados para políticas públicas de mobilidade sustentável.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* New Alert Modal */}
      <Modal
        visible={showNewAlert}
        animationType="slide"
        transparent
        onRequestClose={() => setShowNewAlert(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.alertSheet, { backgroundColor: colors.background, borderColor: colors.border, paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.sheetHandle} />
            
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Novo Alerta de Preço</Text>
                <Pressable onPress={() => setShowNewAlert(false)}>
                  <IconSymbol name="xmark" size={20} color={colors.muted} />
                </Pressable>
              </View>

              <Text style={[styles.sheetSectionLabel, { color: colors.muted }]}>COMBUSTÍVEL</Text>
              <View style={styles.fuelGrid}>
                {FUEL_TYPES.map(type => (
                  <Pressable
                    key={type}
                    onPress={() => setAlertFuel(type)}
                    style={({ pressed }) => [
                      styles.fuelOption,
                      {
                        backgroundColor: alertFuel === type ? colors.primary + '15' : colors.surface,
                        borderColor: alertFuel === type ? colors.primary : colors.border,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 20 }}>{FUEL_TYPE_ICONS[type]}</Text>
                    <Text style={[styles.fuelOptionText, { color: alertFuel === type ? colors.primary : colors.foreground }]}>
                      {FUEL_TYPE_LABELS[type]}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.sheetSectionLabel, { color: colors.muted }]}>PREÇO MÁXIMO</Text>
              <View style={[styles.priceInputRow, { backgroundColor: colors.surface, borderColor: alertError ? colors.error : colors.border }]}>
                <Text style={[styles.currencySymbol, { color: colors.muted }]}>R$</Text>
                <TextInput
                  style={[styles.priceInput, { color: colors.foreground }]}
                  placeholder="0,00"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  value={alertPrice}
                  onChangeText={v => { setAlertPrice(v); setAlertError(''); }}
                  returnKeyType="done"
                />
                <Text style={[styles.perLiter, { color: colors.muted }]}>/litro</Text>
              </View>
              {alertError ? (
                <Text style={[styles.errorText, { color: colors.error }]}>{alertError}</Text>
              ) : null}

              <Text style={[styles.sheetSectionLabel, { color: colors.muted }]}>POSTO (OPCIONAL)</Text>

              {/* Posto selecionado ou campo de busca */}
              {selectedAlertStation ? (
                // Posto já selecionado — exibe com botão de limpar
                <Pressable
                  onPress={() => { setAlertStationId(undefined); setStationSearch(''); }}
                  style={[styles.selectedStationRow, { backgroundColor: colors.primary + '12', borderColor: colors.primary }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.selectedStationName, { color: colors.foreground }]} numberOfLines={1}>
                      {selectedAlertStation.name}
                    </Text>
                    <Text style={[styles.selectedStationAddr, { color: colors.muted }]} numberOfLines={1}>
                      {selectedAlertStation.neighborhood}
                    </Text>
                  </View>
                  <View style={[styles.clearStationBtn, { backgroundColor: colors.border }]}>
                    <IconSymbol name="xmark" size={12} color={colors.muted} />
                  </View>
                </Pressable>
              ) : (
                <>
                  {/* Opção: qualquer posto */}
                  <Pressable
                    onPress={() => setAlertStationId(undefined)}
                    style={[
                      styles.stationOption,
                      {
                        backgroundColor: !alertStationId ? colors.primary + '15' : colors.surface,
                        borderColor: !alertStationId ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.stationOptionText, { color: !alertStationId ? colors.primary : colors.foreground }]}>
                      Qualquer posto em Manaus
                    </Text>
                    {!alertStationId && <IconSymbol name="checkmark" size={14} color={colors.primary} />}
                  </Pressable>

                  {/* Campo de busca de posto */}
                  <View style={[styles.stationSearchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <IconSymbol name="magnifyingglass" size={15} color={colors.muted} />
                    <TextInput
                      style={[styles.stationSearchInput, { color: colors.foreground }]}
                      placeholder="Buscar posto específico..."
                      placeholderTextColor={colors.muted}
                      value={stationSearch}
                      onChangeText={v => { setStationSearch(v); setShowStationPicker(true); }}
                      onFocus={() => setShowStationPicker(true)}
                    />
                    {stationSearch.length > 0 && (
                      <Pressable onPress={() => { setStationSearch(''); setShowStationPicker(false); }}>
                        <IconSymbol name="xmark.circle.fill" size={15} color={colors.muted} />
                      </Pressable>
                    )}
                  </View>

                  {/* Lista de postos filtrada */}
                  {showStationPicker && (
                    <View style={[styles.stationPickerList, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      {stationsForAlertPicker.slice(0, 5).map(s => {
                        const isFav = state.favoriteIds.includes(s.id);
                        return (
                          <Pressable
                            key={s.id}
                            onPress={() => {
                              setAlertStationId(s.id);
                              setStationSearch('');
                              setShowStationPicker(false);
                            }}
                            style={({ pressed }) => [
                              styles.stationPickerItem,
                              {
                                borderBottomColor: colors.border,
                                backgroundColor: isFav ? colors.primary + '08' : 'transparent',
                                opacity: pressed ? 0.75 : 1,
                              },
                            ]}
                          >
                            <View style={{ flex: 1 }}>
                              <View style={styles.stationPickerNameRow}>
                                <Text style={[styles.stationPickerName, { color: colors.foreground }]} numberOfLines={1}>
                                  {s.name}
                                </Text>
                                {isFav && (
                                  <Text style={[styles.stationPickerFavText, { color: colors.primary }]}>⭐</Text>
                                )}
                              </View>
                              <Text style={[styles.stationPickerAddr, { color: colors.muted }]} numberOfLines={1}>
                                {s.neighborhood} · {s.brand}
                              </Text>
                            </View>
                            <IconSymbol name="chevron.right" size={13} color={colors.muted} />
                          </Pressable>
                        );
                      })}
                      {stationsForAlertPicker.length === 0 && (
                        <Text style={[styles.stationPickerEmpty, { color: colors.muted }]}>Nenhum posto encontrado</Text>
                      )}
                    </View>
                  )}
                </>
              )}

              <Pressable
                onPress={handleCreateAlert}
                style={({ pressed }) => [
                  styles.createBtn,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1, marginTop: 10 },
                ]}
              >
                <IconSymbol name="bell.fill" size={16} color="#fff" />
                <Text style={styles.createBtnText}>Criar Alerta</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingTop: 12,
    gap: 4,
    paddingBottom: 32,
  },
  profileCard: {
    marginBottom: 8,
    overflow: 'hidden',
  },
  profileCardAccent: {
    height: 6,
    width: '100%',
  },
  profileCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 20,
  },
  avatarRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    lineHeight: 30,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 21,
  },
  profileSub: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  contributionBadge: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  contributionCount: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
  },
  contributionLabel: {
    fontSize: 10,
    lineHeight: 14,
  },
  section: {
    gap: 8,
    marginTop: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  emptyAlerts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  emptyAlertsText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  alertIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  alertSub: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 6,
  },
  contributionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
  },
  contribStation: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  contribDetails: {
    fontSize: 12,
    lineHeight: 16,
  },
  contribBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  contribBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },
  settingsCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 19,
  },
  settingValue: {
    fontSize: 12,
    lineHeight: 16,
  },
  ecoCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
    alignItems: 'flex-start',
  },
  ecoTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 4,
  },
  ecoText: {
    fontSize: 13,
    lineHeight: 19,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  alertSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#1F30A0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  sheetSectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    lineHeight: 16,
    marginTop: 4,
  },
  fuelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fuelOption: {
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 4,
    flexBasis: '30%',
    flexGrow: 1,
    minWidth: 92,
  },
  fuelOptionText: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    textAlign: 'center',
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  priceInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
    padding: 0,
  },
  perLiter: {
    fontSize: 14,
    lineHeight: 19,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 17,
  },
  stationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  stationOptionText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 19,
  },
  // Seleção de posto com busca
  selectedStationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  selectedStationName: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  selectedStationAddr: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 1,
  },
  clearStationBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stationSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  stationSearchInput: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    padding: 0,
  },
  stationPickerList: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  stationPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 0.5,
    gap: 8,
  },
  stationPickerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stationPickerName: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    flexShrink: 1,
  },
  stationPickerFavText: {
    fontSize: 12,
    lineHeight: 16,
  },
  stationPickerAddr: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 1,
  },
  stationPickerEmpty: {
    padding: 14,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 4,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
});
