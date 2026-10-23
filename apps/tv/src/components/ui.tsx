import React, { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import {
  SpatialNavigationFocusableView,
  SpatialNavigationNode,
  SpatialNavigationRoot,
} from 'react-tv-space-navigation';
import { useApp } from '../useStore';
import { FOCUS, FONT, lineHeight, palettes, px, RADIUS, SAFE, type, type Palette } from '../theme/tokens';

const ThemeCtx = createContext<Palette>(palettes.dark);
export const useTheme = () => useContext(ThemeCtx);

/** True inside a focused platter: text flips to the dark label colour (tvOS button focus). */
const OnPlatter = createContext(false);

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
  bleed = false,
}: {
  children: ReactNode;
  active?: boolean;
  style?: ViewStyle;
  /** full-bleed: no safe-area padding (the screen places its own content) */
  bleed?: boolean;
}) {
  const c = useTheme();
  return (
    <SpatialNavigationRoot isActive={active}>
      <View
        style={[
          { flex: 1, backgroundColor: c.bg },
          !bleed && { paddingHorizontal: px(SAFE.h), paddingVertical: px(SAFE.v) },
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
  const onPlatter = useContext(OnPlatter);
  const fs = type[size];
  let col = color ?? c.text;
  if (onPlatter) {
    if (!color || color === c.text) col = c.onFocus;
    else if (color === c.muted || color === c.faint) col = 'rgba(11,11,12,0.62)';
  }
  const heading = size === 'display' || size === 'h1' || size === 'h2' || size === 'headline';
  return (
    <Text
      numberOfLines={lines}
      style={[
        {
          color: col,
          fontFamily: FONT,
          fontSize: px(fs),
          lineHeight: px(lineHeight[size]),
          fontWeight: weight ?? (heading ? '700' : '500'),
          letterSpacing: size === 'display' ? px(-0.5) : 0,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

function FocusBody({
  focused,
  variant,
  scale,
  style,
  focusedStyle,
  children,
}: {
  focused: boolean;
  variant: 'platter' | 'lift';
  scale: number;
  style?: ViewStyle;
  focusedStyle?: ViewStyle;
  children: ReactNode;
}) {
  const c = useTheme();
  const motion = useMotion();
  const anim = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    if (!motion) return anim.setValue(focused ? 1 : 0);
    Animated.timing(anim, { toValue: focused ? 1 : 0, duration: FOCUS.ms, useNativeDriver: true }).start();
  }, [focused, motion, anim]);
  const s = anim.interpolate({ inputRange: [0, 1], outputRange: [1, motion ? scale : 1] });
  return (
    <Animated.View
      style={[
        { borderRadius: px(RADIUS.button), transform: [{ scale: s }] },
        style,
        focused && (variant === 'platter' ? { backgroundColor: c.focus } : { borderColor: c.focus }),
        focused && {
          shadowColor: c.shadow,
          shadowOpacity: 0.5,
          shadowRadius: px(28),
          shadowOffset: { width: 0, height: px(18) },
          elevation: 12,
        },
        focused && focusedStyle,
      ]}
    >
      <OnPlatter.Provider value={focused && variant === 'platter'}>{children}</OnPlatter.Provider>
    </Animated.View>
  );
}

/**
 * Remote-focusable element. "platter" (default) turns white with a dark label when focused, like a tvOS
 * button; "lift" scales the element up with a deep shadow and a thin light edge, like a tvOS lockup.
 */
export function Focusable({
  onSelect,
  children,
  style,
  focusedStyle,
  testID,
  variant = 'platter',
  scale,
}: {
  onSelect?: () => void;
  children: (focused: boolean) => ReactNode;
  style?: ViewStyle;
  focusedStyle?: ViewStyle;
  testID?: string;
  variant?: 'platter' | 'lift';
  scale?: number;
}) {
  return (
    <SpatialNavigationFocusableView onSelect={onSelect}>
      {({ isFocused }: { isFocused: boolean }) => (
        <Pressable testID={testID} onPress={onSelect}>
          <FocusBody
            focused={isFocused}
            variant={variant}
            scale={scale ?? (variant === 'lift' ? FOCUS.card : FOCUS.button)}
            style={variant === 'lift' ? { borderWidth: px(3), borderColor: 'transparent', ...style } : style}
            focusedStyle={focusedStyle}
          >
            {children(isFocused)}
          </FocusBody>
        </Pressable>
      )}
    </SpatialNavigationFocusableView>
  );
}

/**
 * tvOS button: 72 px platter, 14 px radius, glass when idle, white with a dark label when focused.
 * "primary" is the one call to action on a screen: a brighter platter at rest so it reads first.
 */
export function Button({
  label,
  onSelect,
  primary,
  icon,
  disabled,
  testID,
  width,
}: {
  label: string;
  onSelect: () => void;
  primary?: boolean;
  icon?: string;
  disabled?: boolean;
  testID?: string;
  width?: number;
}) {
  const c = useTheme();
  return (
    <Focusable
      testID={testID}
      onSelect={disabled ? undefined : onSelect}
      style={{
        backgroundColor: primary ? 'rgba(255,255,255,0.28)' : c.surface2,
        paddingHorizontal: px(40),
        height: px(72),
        minWidth: px(width ?? 0),
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: px(14),
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {() => (
        <>
          {icon ? <T weight="700">{icon}</T> : null}
          <T weight="700">{label}</T>
        </>
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
    <View style={[styles.chip, { backgroundColor: 'rgba(0,0,0,0.45)', borderColor: c.hairline }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <T size="caption" weight="600">
        {icon ? `${icon} ` : ''}
        {label}
      </T>
    </View>
  );
}

/** Glass panel (tvOS material, without blur: Vega has no backdrop filter). */
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const c = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: c.surface,
          borderRadius: px(RADIUS.panel),
          padding: px(32),
          borderWidth: px(1),
          borderColor: c.hairline,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Thin label above a group of content (tvOS section header): sentence case, secondary colour. */
export function SectionHeader({ children, style }: { children: ReactNode; style?: TextStyle }) {
  const c = useTheme();
  return (
    <T size="headline" color={c.text} style={{ marginBottom: px(20), ...style }}>
      {children}
    </T>
  );
}

/**
 * Full-bleed artwork with tvOS-style fades: a left-to-right darkening for the text column and a bottom
 * fade into the canvas. The image is decorative; text never relies on it for contrast.
 */
export function Backdrop({
  source,
  tint,
  dim = 0.35,
  children,
}: {
  source?: ImageSourcePropType | null;
  tint?: string;
  dim?: number;
  children?: ReactNode;
}) {
  const c = useTheme();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {source ? (
        <Image source={source} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: c.solid }]} />
      )}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${dim})` }]} />
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="bdLeft" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={tint ?? c.bg} stopOpacity="0.92" />
            <Stop offset="0.45" stopColor={tint ?? c.bg} stopOpacity="0.55" />
            <Stop offset="0.8" stopColor={tint ?? c.bg} stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="bdBottom" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.35" stopColor={c.bg} stopOpacity="0" />
            <Stop offset="1" stopColor={c.bg} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#bdLeft)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#bdBottom)" />
      </Svg>
      {children}
    </View>
  );
}

/** Full-screen designed state (loading / error / empty), tvOS alert layout: centred column on black. */
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
    <Screen style={{ justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: px(1040), gap: px(24), alignItems: 'center' }}>
        <View style={[styles.iconWrap, { backgroundColor: c.surface, borderColor: c.hairline }]}>
          <T size="h1" color={c.muted}>
            {icon}
          </T>
        </View>
        <T size="h1" style={{ textAlign: 'center' }}>
          {title}
        </T>
        {typeof body === 'string' ? (
          <T color={c.muted} style={{ textAlign: 'center' }}>
            {body}
          </T>
        ) : (
          body
        )}
        {actions && (
          <SpatialNavigationNode orientation="horizontal">
            <View style={{ flexDirection: 'row', gap: px(24), marginTop: px(24) }}>{actions}</View>
          </SpatialNavigationNode>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: px(12),
    paddingHorizontal: px(20),
    height: px(48),
    borderRadius: px(RADIUS.pill),
    borderWidth: px(1),
  },
  dot: { width: px(12), height: px(12), borderRadius: px(6) },
  iconWrap: {
    width: px(132),
    height: px(132),
    borderRadius: px(66),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: px(1),
  },
});
