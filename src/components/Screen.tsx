import React from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useStore } from '../data/store';
import { useTheme } from '../theme/ThemeContext';
import { H1, Row, T, useWide } from './ui';

export function Screen({
  title,
  subtitle,
  actions,
  children,
  scroll = true,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  scroll?: boolean;
}) {
  const { c } = useTheme();
  const wide = useWide();
  const { refresh } = useStore();
  const [refreshing, setRefreshing] = React.useState(false);

  const header = (
    <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap' }} gap={12}>
      <View style={{ flex: 1, minWidth: 200, gap: 2 }}>
        <H1 size={wide ? 26 : 22}>{title}</H1>
        {subtitle && <T muted>{subtitle}</T>}
      </View>
      {actions && (
        <Row wrap style={{ maxWidth: '100%', flexShrink: 1 }}>
          {actions}
        </Row>
      )}
    </Row>
  );

  const pad = wide ? 28 : 16;
  if (!scroll)
    return (
      <View style={{ flex: 1, padding: pad, backgroundColor: c.bg }}>
        {header}
        {children}
      </View>
    );
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ padding: pad, paddingBottom: 100, maxWidth: 1400, width: '100%', alignSelf: 'center' }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await refresh();
            setRefreshing(false);
          }}
        />
      }
    >
      {header}
      {children}
    </ScrollView>
  );
}

// Responsive grid: children laid out in columns on wide screens.
export function Grid({ children, min = 280, gap = 14 }: { children: React.ReactNode; min?: number; gap?: number }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap, marginBottom: gap }}>
      {React.Children.map(children, (ch) =>
        ch ? <View style={{ flexGrow: 1, flexBasis: min, minWidth: Math.min(min, 260) }}>{ch}</View> : null,
      )}
    </View>
  );
}
