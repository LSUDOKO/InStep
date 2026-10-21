import React, { createContext, useContext, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { SpatialNavigationFocusableView, SpatialNavigationRoot } from 'react-tv-space-navigation';
import { useApp } from '../useStore';
import { palettes, px, SAFE, type, type Palette } from '../theme/tokens';

const ThemeCtx = createContext<Palette>(palettes.dark);
export const useTheme = () => useContext(ThemeCtx);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const hc = useApp((s) => s.settings.highContrast);
  return <ThemeCtx.Provider value={hc ? palettes.highContrast : palettes.dark}>{children}</ThemeCtx.Provider>;
}

export function useMotion() {
  return !useApp((s) => s.settings.reduceMotion);
}

/** One spatial-navigation root per screen; inactive screens never steal focus. */
export function Screen({
  children,
  active = true,
  style,
}: {
  children: ReactNode;
  active?: boolean;
  style?: ViewStyle;
}) {
  const c = useTheme();
  return (
    <SpatialNavigationRoot isActive={active}>
      <View
        style={[
          { flex: 1, backgroundColor: c.bg, paddingHorizontal: px(SAFE.h), paddingVertical: px(SAFE.v) },
          style,
        ]}
      >
        {children}
      </View>
    </SpatialNavigationRoot>
  );
}

export function T({
  size = 'body',
  color,
  weight,
  style,
  children,
  lines,
}: {
  size?: keyof typeof type;
  color?: string;
  weight?: TextStyle['fontWeight'];
  style?: TextStyle;
  children: ReactNode;
  lines?: number;
}) {
  const c = useTheme();
  const fs = type[size];
  return (
    <Text
      numberOfLines={lines}
      style={[
        {
          color: color ?? c.text,
          fontSize: px(fs),
          lineHeight: px(fs * 1.2),
          fontWeight: weight ?? (size === 'body' || size === 'caption' ? '400' : '700'),
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** Focus state per docs/09: scale 1.06, white 3 px ring, raised background. */
export function Focusable({
  onSelect,
  children,
  style,
  focusedStyle,
  testID,
}: {
  onSelect?: () => void;
  children: (focused: boolean) => ReactNode;
  style?: ViewStyle;
  focusedStyle?: ViewStyle;
  testID?: string;
}) {
  const c = useTheme();
  const motion = useMotion();
  return (
    <SpatialNavigationFocusableView onSelect={onSelect}>
      {({ isFocused }: { isFocused: boolean }) => (
        <Pressable
          testID={testID}
          onPress={onSelect}
          style={[
            { borderRadius: px(16), borderWidth: px(3), borderColor: 'transparent' },
            style,
            isFocused && {
              borderColor: c.focus,
              backgroundColor: c.surface2,
              ...(motion ? { transform: [{ scale: 1.06 }] } : {}),
            },
            isFocused && focusedStyle,
          ]}
        >
          {children(isFocused)}
        </Pressable>
      )}
    </SpatialNavigationFocusableView>
  );
}

export function Button({
  label,
  onSelect,
  primary,
  icon,
  disabled,
  testID,
}: {
  label: string;
  onSelect: () => void;
  primary?: boolean;
  icon?: string;
  disabled?: boolean;
  testID?: string;
}) {
  const c = useTheme();
  return (
    <Focusable
      testID={testID}
      onSelect={disabled ? undefined : onSelect}
      style={{
        backgroundColor: primary ? c.brand : c.surface2,
        paddingHorizontal: px(40),
        height: px(84),
        justifyContent: 'center',
        opacity: disabled ? 0.45 : 1,
      }}
      focusedStyle={primary ? { backgroundColor: c.brand } : {}}
    >
      {() => (
        <T weight="700" color={primary ? '#04201D' : c.text}>
          {icon ? `${icon}  ` : ''}
          {label}
        </T>
      )}
    </Focusable>
  );
}

export function Chip({
  label,
  tone = 'info',
  icon,
}: {
  label: string;
  tone?: 'ok' | 'near' | 'far' | 'info' | 'brand';
  icon?: string;
}) {
  const c = useTheme();
  const color = { ok: c.ok, near: c.near, far: c.far, info: c.info, brand: c.brand }[tone];
  return (
    <View style={[styles.chip, { backgroundColor: c.surface2 }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <T size="caption" color={color} weight="700">
        {icon ? `${icon} ` : ''}
        {label}
      </T>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const c = useTheme();
  return (
    <View style={[{ backgroundColor: c.surface, borderRadius: px(24), padding: px(32) }, style]}>
      {children}
    </View>
  );
}

/** Full-screen designed state (loading / error / empty). */
export function StateScreen({
  icon,
  title,
  body,
  actions,
}: {
  icon: string;
  title: string;
  body?: ReactNode;
  actions?: ReactNode;
}) {
  const c = useTheme();
  return (
    <Screen style={{ justifyContent: 'center' }}>
      <View style={{ maxWidth: px(1200), gap: px(28) }}>
        <View style={[styles.iconWrap, { backgroundColor: c.surface2 }]}>
          <T size="h1" color={c.brand}>
            {icon}
          </T>
        </View>
        <T size="h1">{title}</T>
        {typeof body === 'string' ? <T color={c.muted}>{body}</T> : body}
        {actions && <View style={{ flexDirection: 'row', gap: px(24), marginTop: px(16) }}>{actions}</View>}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: px(10),
    paddingHorizontal: px(20),
    paddingVertical: px(8),
    borderRadius: px(999),
  },
  dot: { width: px(14), height: px(14), borderRadius: px(7) },
  iconWrap: {
    width: px(120),
    height: px(120),
    borderRadius: px(32),
    alignItems: 'center',
    justifyContent: 'center',
  },
});
