import React from 'react';
import { Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { useColors } from '@/hooks/theme/use-colors';
import { FuelType, FUEL_TYPE_LABELS, FUEL_TYPE_ICONS } from '@/data/stations';
import * as Haptics from 'expo-haptics';

const FUEL_TYPES: FuelType[] = ['gasolina', 'aditivada', 'etanol', 'diesel', 'gnv'];

interface FuelTypeFilterProps {
  selected: FuelType;
  onSelect: (type: FuelType) => void;
}

export function FuelTypeFilter({ selected, onSelect }: FuelTypeFilterProps) {
  const colors = useColors();

  const handleSelect = (type: FuelType) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(type);
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {FUEL_TYPES.map(type => {
        const isSelected = type === selected;
        return (
          <Pressable
            key={type}
            onPress={() => handleSelect(type)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: isSelected ? colors.primary : colors.surface,
                borderColor: isSelected ? colors.primary : colors.border,
                opacity: pressed ? 0.8 : 1,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              },
            ]}
          >
            <Text style={styles.icon}>{FUEL_TYPE_ICONS[type]}</Text>
            <Text
              style={[
                styles.label,
                { color: isSelected ? '#FFFFFF' : colors.foreground },
              ]}
            >
              {FUEL_TYPE_LABELS[type]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 22,
    borderWidth: 1.5,
    // sombra sutil para dar profundidade
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  },
  icon: {
    fontSize: 15,
    lineHeight: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    letterSpacing: 0.1,
  },
});
