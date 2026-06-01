/**
 * Abastece Manaus - Design System Tokens
 * Identidade utilitaria inspirada em economia, combustivel, rios e floresta.
 *
 * Estrutura:
 * - baseColors: paleta bruta
 * - themeColors: mapeamento light/dark consumido pelo app
 * - tokens: espacamento, raio, tipografia, sombras e gradientes
 */

const baseColors = {
  forest: {
    DEFAULT: '#1B6B43',
    light: '#2E8B57',
    dark: '#0F3D2E',
    tint: '#EDF8F1',
  },
  river: {
    DEFAULT: '#1F7A8C',
    light: '#35A7B8',
    dark: '#145766',
    tint: '#EAF7F9',
  },
  amber: {
    DEFAULT: '#F2C14E',
    light: '#F7D77A',
    dark: '#9A6B10',
    tint: '#FFF8E2',
  },
  red: {
    DEFAULT: '#DC2626',
    light: '#F87171',
    dark: '#991B1B',
  },
  fuel: {
    gasoline: '#2563EB',
    ethanol: '#16A34A',
    diesel: '#7C3AED',
    gnv: '#0EA5E9',
  },
  slate: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },
};

const themeColors = {
  primary: { light: baseColors.forest.DEFAULT, dark: baseColors.forest.light },
  secondary: { light: baseColors.river.DEFAULT, dark: baseColors.river.light },
  accent: { light: baseColors.amber.dark, dark: baseColors.amber.light },

  background: { light: '#F7FAF8', dark: '#07130F' },
  surface: { light: '#FFFFFF', dark: '#102019' },
  card: { light: '#FFFFFF', dark: '#14261E' },

  foreground: { light: '#1F2933', dark: '#ECFDF3' },
  muted: { light: '#5D6B62', dark: '#A7B8AA' },
  border: { light: '#D9E7DE', dark: '#244534' },
  tint: { light: baseColors.forest.DEFAULT, dark: baseColors.forest.light },

  success: { light: baseColors.forest.DEFAULT, dark: baseColors.forest.light },
  warning: { light: baseColors.amber.dark, dark: baseColors.amber.light },
  error: { light: baseColors.red.DEFAULT, dark: baseColors.red.light },

  priceCheap: { light: baseColors.forest.DEFAULT, dark: baseColors.forest.light },
  priceMedium: { light: baseColors.amber.DEFAULT, dark: baseColors.amber.light },
  priceExpensive: { light: baseColors.red.DEFAULT, dark: baseColors.red.light },

  fuelGasoline: { light: baseColors.river.DEFAULT, dark: '#60D4E6' },
  fuelEthanol: { light: baseColors.fuel.ethanol, dark: '#4ADE80' },
  fuelDiesel: { light: baseColors.fuel.diesel, dark: '#A78BFA' },
  fuelGnv: { light: baseColors.fuel.gnv, dark: '#38BDF8' },
};

const tokens = {
  radius: {
    xs: 6,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },
  space: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40,
  },
  font: {
    size: {
      xs: 11,
      sm: 13,
      md: 15,
      lg: 17,
      xl: 22,
      xxl: 28,
    },
    lineHeight: {
      xs: 16,
      sm: 18,
      md: 22,
      lg: 24,
      xl: 30,
      xxl: 36,
    },
    weight: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extraBold: '800',
    },
  },
  shadows: {
    soft: {
      shadowColor: baseColors.slate[900],
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 1,
    },
    medium: {
      shadowColor: baseColors.slate[900],
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.07,
      shadowRadius: 14,
      elevation: 3,
    },
    premium: {
      shadowColor: baseColors.forest.DEFAULT,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 4,
    },
  },
  gradients: {
    primary: [baseColors.forest.light, baseColors.forest.DEFAULT],
    secondary: [baseColors.river.light, baseColors.river.DEFAULT],
    nature: [baseColors.river.DEFAULT, baseColors.forest.DEFAULT],
    surface: ['#FFFFFF', baseColors.forest.tint],
  },
};

module.exports = {
  themeColors,
  tokens,
  baseColors,
};
