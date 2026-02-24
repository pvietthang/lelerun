// LeLeRun Design System - Duolingo-inspired theme

export const Colors = {
  primary: '#58CC02',
  primaryDark: '#46A302',
  primaryLight: '#7ED321',
  secondary: '#CE82FF',
  accent: '#FF9600',
  danger: '#FF4B4B',
  dangerDark: '#EA2B2B',
  warning: '#FFC800',

  // Backgrounds
  background: '#FFFFFF',
  backgroundSecondary: '#F7F7F7',
  backgroundCard: '#FFFFFF',
  surface: '#E5E5E5',

  // Text
  text: '#3C3C3C',
  textSecondary: '#777777',
  textLight: '#AFAFAF',
  textOnPrimary: '#FFFFFF',

  // Streak & RP
  streakFire: '#FF9600',
  rpGem: '#CE82FF',

  // Calendar
  calendarCompleted: '#58CC02',
  calendarMissed: '#FF4B4B',
  calendarFuture: '#E5E5E5',
  calendarToday: '#1CB0F6',
  calendarStreak: '#FFC800',

  // Status bar / navigation
  tabBarBackground: '#FFFFFF',
  tabBarActive: '#58CC02',
  tabBarInactive: '#AFAFAF',

  // Borders
  border: '#E5E5E5',
  borderLight: '#F0F0F0',

  light: {
    text: '#3C3C3C',
    background: '#FFFFFF',
    tint: '#58CC02',
    icon: '#687076',
    tabIconDefault: '#AFAFAF',
    tabIconSelected: '#58CC02',
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: '#58CC02',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#58CC02',
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const FontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 24,
  xxl: 32,
  hero: 48,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  button: {
    shadowColor: '#46A302',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  buttonDanger: {
    shadowColor: '#EA2B2B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
};
