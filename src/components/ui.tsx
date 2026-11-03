import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import type { Tone } from '../data/catalog';
import { useTheme } from '../theme/ThemeContext';

export type IconName = keyof typeof Ionicons.glyphMap;

export const useWide = () => useWindowDimensions().width >= 900;

export function toneColor(c: ReturnType<typeof useTheme>['c'], tone: Tone) {
  switch (tone) {
    case 'success':
      return c.success;
    case 'warning':
      return c.warning;
    case 'danger':
      return c.danger;
    case 'info':
      return c.info;
    case 'primary':
      return c.primary;
    default:
      return c.textMuted;
  }
}

/* --------------------------------- Text --------------------------------- */

type TProps = {
  children?: React.ReactNode;
  style?: StyleProp<TextStyle>;
  muted?: boolean;
  size?: number;
  weight?: '400' | '500' | '600' | '700' | '800';
  color?: string;
  numberOfLines?: number;
  center?: boolean;
};

export function T({ children, style, muted, size = 14, weight = '400', color, numberOfLines, center }: TProps) {
  const { c } = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        { color: color ?? (muted ? c.textMuted : c.text), fontSize: size, fontWeight: weight },
        center && { textAlign: 'center' },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export const H1 = (p: TProps) => <T size={24} weight="800" {...p} />;
export const H2 = (p: TProps) => <T size={17} weight="700" {...p} />;

/* --------------------------------- Card --------------------------------- */

export function Card({
  children,
  style,
  onPress,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  padded?: boolean;
}) {
  const { c, dark } = useTheme();
  const base: ViewStyle = {
    backgroundColor: c.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    padding: padded ? 16 : 0,
    ...(dark
      ? {}
      : Platform.select<ViewStyle>({
          web: { boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)' } as ViewStyle,
          default: { elevation: 1 },
        })),
  };
  if (onPress)
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.85 }, style]}>
        {children}
      </Pressable>
    );
  return <View style={[base, style]}>{children}</View>;
}

/* -------------------------------- Buttons -------------------------------- */

export function Button({
  title,
  onPress,
  icon,
  variant = 'primary',
  loading,
  disabled,
  style,
  small,
}: {
  title: string;
  onPress?: () => void;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const { c } = useTheme();
  const bg =
    variant === 'primary' ? c.primary : variant === 'danger' ? c.danger : variant === 'secondary' ? c.surfaceAlt : 'transparent';
  const fg = variant === 'primary' ? c.primaryText : variant === 'danger' ? '#fff' : variant === 'ghost' ? c.primary : c.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          paddingHorizontal: small ? 12 : 16,
          height: small ? 34 : 44,
          borderRadius: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: c.border,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        icon && <Ionicons name={icon} size={small ? 16 : 18} color={fg} />
      )}
      <Text style={{ color: fg, fontWeight: '700', fontSize: small ? 13 : 15 }}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  color,
  size = 22,
  badge,
  style,
  label,
}: {
  icon: IconName;
  onPress?: () => void;
  color?: string;
  size?: number;
  badge?: number;
  style?: StyleProp<ViewStyle>;
  label?: string;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [{ padding: 6, borderRadius: 10, opacity: pressed ? 0.6 : 1 }, style]}
    >
      <Ionicons name={icon} size={size} color={color ?? c.text} />
      {!!badge && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: c.danger,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 3,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

/* --------------------------------- Inputs -------------------------------- */

export function Field({
  label,
  hint,
  style,
  ...props
}: TextInputProps & { label?: string; hint?: string; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ gap: 6 }, style]}>
      {label && <T size={13} weight="600" muted>{label}</T>}
      <TextInput
        placeholderTextColor={c.textMuted}
        {...props}
        onFocus={(e) => {
          setFocus(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          props.onBlur?.(e);
        }}
        style={[
          {
            backgroundColor: c.surface,
            borderColor: focus ? c.primary : c.border,
            borderWidth: 1,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: props.multiline ? 10 : 0,
            height: props.multiline ? undefined : 44,
            minHeight: props.multiline ? 88 : undefined,
            color: c.text,
            fontSize: 15,
            textAlignVertical: props.multiline ? 'top' : 'center',
          },
          Platform.OS === 'web' && ({ outlineStyle: 'none' } as unknown as TextStyle),
        ]}
      />
      {hint && <T size={12} muted>{hint}</T>}
    </View>
  );
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search…',
  style,
  autoFocus,
}: {
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  autoFocus?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: c.surface,
          borderColor: c.border,
          borderWidth: 1,
          borderRadius: 12,
          paddingHorizontal: 12,
          height: 44,
          gap: 8,
        },
        style,
      ]}
    >
      <Ionicons name="search" size={18} color={c.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        autoFocus={autoFocus}
        style={[{ flex: 1, color: c.text, fontSize: 15, height: 42 }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as unknown as TextStyle)]}
      />
      {!!value && <IconButton icon="close-circle" size={18} color={c.textMuted} onPress={() => onChangeText('')} />}
    </View>
  );
}

export type Option = { value: string; label: string; sub?: string };

export function Select({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select…',
  style,
  searchable,
  compact,
}: {
  label?: string;
  value: string;
  options: Option[];
  onChange: (v: string) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  searchable?: boolean;
  compact?: boolean;
}) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const current = options.find((o) => o.value === value);
  const shown = q ? options.filter((o) => (o.label + ' ' + (o.sub ?? '')).toLowerCase().includes(q.toLowerCase())) : options;
  return (
    <View style={[{ gap: 6 }, style]}>
      {label && <T size={13} weight="600" muted>{label}</T>}
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          height: compact ? 36 : 44,
          borderRadius: compact ? 10 : 12,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.surface,
          paddingHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <T style={{ flex: 1 }} numberOfLines={1} muted={!current} size={compact ? 13 : 15}>
          {current?.label ?? placeholder}
        </T>
        <Ionicons name="chevron-down" size={16} color={c.textMuted} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label ?? placeholder}>
        {(searchable || options.length > 8) && <SearchBar value={q} onChangeText={setQ} style={{ marginBottom: 8 }} />}
        {shown.map((o) => (
          <Pressable
            key={o.value}
            onPress={() => {
              onChange(o.value);
              setOpen(false);
              setQ('');
            }}
            style={({ pressed }) => ({
              paddingVertical: 12,
              paddingHorizontal: 12,
              borderRadius: 10,
              backgroundColor: o.value === value ? c.primarySoft : pressed ? c.surfaceAlt : 'transparent',
              flexDirection: 'row',
              alignItems: 'center',
            })}
          >
            <View style={{ flex: 1 }}>
              <T weight={o.value === value ? '700' : '500'}>{o.label}</T>
              {o.sub && <T size={12} muted>{o.sub}</T>}
            </View>
            {o.value === value && <Ionicons name="checkmark" size={18} color={c.primary} />}
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}

export function Chips<V extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: V; label: string; count?: number }[];
  value: V;
  onChange: (v: V) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style} contentContainerStyle={{ gap: 8 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={{
              paddingHorizontal: 14,
              height: 34,
              borderRadius: 17,
              backgroundColor: on ? c.primary : c.surface,
              borderWidth: 1,
              borderColor: on ? c.primary : c.border,
              justifyContent: 'center',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <T size={13} weight="600" color={on ? c.primaryText : c.text}>
              {o.label}
            </T>
            {o.count !== undefined && (
              <T size={12} weight="700" color={on ? c.primaryText : c.textMuted}>
                {o.count}
              </T>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/* -------------------------------- Display -------------------------------- */

export function Badge({ label, tone = 'neutral', style }: { label: string; tone?: Tone; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const col = toneColor(c, tone);
  return (
    <View
      style={[
        {
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 999,
          backgroundColor: col + '1F',
        },
        style,
      ]}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: col }} />
      <Text style={{ color: col, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

const AVATAR_COLORS = ['#2C4F82', '#13795B', '#9A6B2F', '#6B4FA0', '#C93B3B', '#D9661F', '#2D6CDF', '#3D4B5C'];

export function Avatar({ name, size = 32 }: { name?: string; size?: number }) {
  const initials = (name ?? '?')
    .split(' ')
    .filter((w) => w && !/^(eng|dr|mr|mrs|ms)\.?$/i.test(w))
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const idx = (name ?? '').split('').reduce((a, ch) => a + ch.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: AVATAR_COLORS[idx],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.38 }}>{initials}</Text>
    </View>
  );
}

export function Progress({ value, color, height = 8 }: { value: number; color?: string; height?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ height, borderRadius: height, backgroundColor: c.surfaceAlt, overflow: 'hidden' }}>
      <View
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          height: '100%',
          backgroundColor: color ?? c.primary,
          borderRadius: height,
        }}
      />
    </View>
  );
}

export function Empty({ icon = 'file-tray-outline', title, sub, action }: { icon?: IconName; title: string; sub?: string; action?: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: 32, gap: 8 }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: c.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={26} color={c.primary} />
      </View>
      <T weight="700" size={15} center>
        {title}
      </T>
      {sub && (
        <T muted center size={13}>
          {sub}
        </T>
      )}
      {action}
    </View>
  );
}

export function Row({ children, style, gap = 8, wrap }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number; wrap?: boolean }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;
}

export function KV({ k, v }: { k: string; v?: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.border, gap: 12 }}>
      <T muted size={13} style={{ width: 140 }}>
        {k}
      </T>
      <View style={{ flex: 1 }}>{typeof v === 'string' || typeof v === 'number' || v == null ? <T size={14}>{v || '—'}</T> : v}</View>
    </View>
  );
}

/* --------------------------------- Sheet --------------------------------- */

export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  const { c } = useTheme();
  const big = useWide();
  return (
    <Modal visible={visible} transparent animationType={big ? 'fade' : 'slide'} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(8,12,20,0.5)', justifyContent: big ? 'center' : 'flex-end', alignItems: 'center' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={{
            backgroundColor: c.bg,
            width: big ? (wide ? 760 : 560) : '100%',
            maxHeight: big ? '88%' : '92%',
            borderRadius: big ? 20 : 0,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            overflow: 'hidden',
          }}
        >
          <Row style={{ paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
            <H2 style={{ flex: 1 }}>{title}</H2>
            <IconButton icon="close" onPress={onClose} label="Close" />
          </Row>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer && (
            <Row style={{ padding: 16, borderTopWidth: 1, borderColor: c.border, backgroundColor: c.surface, justifyContent: 'flex-end' }}>
              {footer}
            </Row>
          )}
        </View>
      </View>
    </Modal>
  );
}

/* ------------------------------ Feedback utils ----------------------------- */

export function confirm(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'OK', style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

type ToastMsg = { id: number; text: string; tone: Tone };
let listeners: ((m: ToastMsg) => void)[] = [];
let counter = 0;

export function toast(text: string, tone: Tone = 'success') {
  const m = { id: ++counter, text, tone };
  listeners.forEach((l) => l(m));
}

export function ToastHost() {
  const { c } = useTheme();
  const [msgs, setMsgs] = useState<ToastMsg[]>([]);
  useEffect(() => {
    const l = (m: ToastMsg) => {
      setMsgs((x) => [...x, m]);
      setTimeout(() => setMsgs((x) => x.filter((y) => y.id !== m.id)), 3200);
    };
    listeners.push(l);
    return () => {
      listeners = listeners.filter((x) => x !== l);
    };
  }, []);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', bottom: 90, left: 0, right: 0, alignItems: 'center', gap: 8 }}>
      {msgs.map((m) => (
        <View
          key={m.id}
          style={{
            backgroundColor: c.text,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 12,
            flexDirection: 'row',
            gap: 8,
            alignItems: 'center',
            maxWidth: '90%',
          }}
        >
          <Ionicons
            name={m.tone === 'danger' ? 'alert-circle' : m.tone === 'warning' ? 'warning' : 'checkmark-circle'}
            size={18}
            color={toneColor(c, m.tone)}
          />
          <Text style={{ color: c.bg, fontWeight: '600' }}>{m.text}</Text>
        </View>
      ))}
    </View>
  );
}

export function errorText(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

// Long lists render in pages so screens stay fast with thousands of records.
export function Paged<X>({ items, render, step = 50 }: { items: X[]; render: (x: X) => React.ReactNode; step?: number }) {
  const { c } = useTheme();
  const [n, setN] = React.useState(step);
  return (
    <>
      {items.slice(0, n).map(render)}
      {items.length > n && (
        <Pressable onPress={() => setN(n + step * 2)} style={({ pressed }) => ({ padding: 14, alignItems: 'center', backgroundColor: pressed ? c.surfaceAlt : 'transparent' })}>
          <T color={c.primary} weight="700" size={13}>
            Show more ({items.length - n} remaining)
          </T>
        </Pressable>
      )}
    </>
  );
}
