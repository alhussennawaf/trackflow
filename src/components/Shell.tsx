import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { backend } from '../data/backend';
import { ROLES } from '../data/catalog';
import { useStore } from '../data/store';
import { useTheme } from '../theme/ThemeContext';
import { RouteName, useNav } from './nav';
import { Avatar, IconButton, IconName, Row, T, ToastHost, useWide } from './ui';

export type MenuItem = { name: RouteName; label: string; icon: IconName; section: string; hr?: boolean; manager?: boolean };

export const MENU: MenuItem[] = [
  { name: 'dashboard', label: 'Dashboard', icon: 'grid-outline', section: 'Work' },
  { name: 'tasks', label: 'Tasks', icon: 'checkbox-outline', section: 'Work' },
  { name: 'submittals', label: 'Submittals', icon: 'document-text-outline', section: 'Work' },
  { name: 'tracker', label: 'Document Tracker', icon: 'analytics-outline', section: 'Work' },
  { name: 'attendance', label: 'Attendance', icon: 'time-outline', section: 'Work' },
  { name: 'projects', label: 'Projects', icon: 'business-outline', section: 'Projects' },
  { name: 'contractors', label: 'Contractors', icon: 'people-circle-outline', section: 'Projects' },
  { name: 'gallery', label: 'Photo Gallery', icon: 'images-outline', section: 'Projects' },
  { name: 'reports', label: 'Daily Reports', icon: 'clipboard-outline', section: 'Projects' },
  { name: 'payroll', label: 'Salary Sheet', icon: 'wallet-outline', section: 'HR', hr: true },
  { name: 'team', label: 'Team & Users', icon: 'person-add-outline', section: 'HR', manager: true },
  { name: 'data', label: 'Backup & Export', icon: 'cloud-download-outline', section: 'Account' },
  { name: 'settings', label: 'Settings', icon: 'settings-outline', section: 'Account' },
];

const TABS: { name: RouteName; label: string; icon: IconName }[] = [
  { name: 'dashboard', label: 'Home', icon: 'grid-outline' },
  { name: 'tasks', label: 'Tasks', icon: 'checkbox-outline' },
  { name: 'submittals', label: 'Submittals', icon: 'document-text-outline' },
  { name: 'attendance', label: 'Attendance', icon: 'time-outline' },
  { name: 'more', label: 'More', icon: 'menu-outline' },
];

// Which top-level item is highlighted for a detail route.
const PARENT: Partial<Record<RouteName, RouteName>> = {
  task: 'tasks',
  project: 'projects',
  submittal: 'submittals',
  contractor: 'contractors',
  person: 'team',
};

export function useMenu() {
  const { isHR, isManager } = useStore();
  return MENU.filter((m) => (!m.hr || isHR || isManager) && (!m.manager || isManager || isHR));
}

function Sidebar() {
  const { c } = useTheme();
  const nav = useNav();
  const items = useMenu();
  const active = PARENT[nav.route.name] ?? nav.route.name;
  let lastSection = '';
  return (
    <View style={{ width: 248, backgroundColor: c.sidebar }}>
      <View style={{ padding: 20, paddingBottom: 12 }}>
        <Image source={require('../../assets/logo-white.png')} style={{ width: 150, height: 60 }} resizeMode="contain" />
        <T size={11} color={c.sidebarText} style={{ marginTop: 6, opacity: 0.8, letterSpacing: 1 }}>
          PROJECT MANAGEMENT
        </T>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20 }}>
        {items.map((m) => {
          const header = m.section !== lastSection;
          lastSection = m.section;
          const on = active === m.name;
          return (
            <View key={m.name}>
              {header && (
                <T size={11} weight="700" color={c.sidebarText} style={{ opacity: 0.55, marginTop: 16, marginBottom: 6, marginLeft: 10, letterSpacing: 1 }}>
                  {m.section.toUpperCase()}
                </T>
              )}
              <Pressable
                onPress={() => nav.go({ name: m.name })}
                style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 10,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                  backgroundColor: on || pressed || hovered ? c.sidebarActive : 'transparent',
                })}
              >
                <Ionicons name={m.icon} size={19} color={on ? '#fff' : c.sidebarText} />
                <T size={14} weight={on ? '700' : '500'} color={on ? '#fff' : c.sidebarText}>
                  {m.label}
                </T>
                {on && <View style={{ marginLeft: 'auto', width: 4, height: 18, borderRadius: 2, backgroundColor: c.accent }} />}
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
      {backend.mode === 'demo' && (
        <View style={{ margin: 12, padding: 10, borderRadius: 10, backgroundColor: 'rgba(232,163,61,0.15)' }}>
          <T size={12} color="#F3C27A" weight="600">
            Demo mode: data is saved on this device only
          </T>
        </View>
      )}
    </View>
  );
}

function TopBar({ onAvatar }: { onAvatar: () => void }) {
  const { c } = useTheme();
  const wide = useWide();
  const nav = useNav();
  const { me, notices } = useStore();
  const unread = notices.filter((n) => n.user_id === me.id && !n.read).length;
  const isRoot = !nav.canGoBack || nav.route.name === 'more' || MENU.some((m) => m.name === nav.route.name);
  return (
    <Row
      style={{
        height: 60,
        paddingHorizontal: wide ? 20 : 10,
        backgroundColor: c.surface,
        borderBottomWidth: 1,
        borderColor: c.border,
      }}
    >
      {nav.canGoBack && !isRoot ? (
        <IconButton icon="arrow-back" onPress={nav.back} label="Back" />
      ) : !wide ? (
        <Image source={require('../../assets/icon.png')} style={{ width: 34, height: 34, borderRadius: 9, marginLeft: 4 }} />
      ) : null}
      <Pressable
        onPress={() => nav.push({ name: 'search' })}
        style={{
          flex: 1,
          maxWidth: 520,
          height: 40,
          borderRadius: 12,
          backgroundColor: c.surfaceAlt,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          gap: 8,
          marginHorizontal: 8,
        }}
      >
        <Ionicons name="search" size={17} color={c.textMuted} />
        <T muted size={14} numberOfLines={1}>
          Search projects, submittals, people…
        </T>
      </Pressable>
      <View style={{ flex: wide ? 1 : 0 }} />
      <IconButton icon="notifications-outline" badge={unread} onPress={() => nav.push({ name: 'notifications' })} label="Notifications" />
      <Pressable onPress={onAvatar} style={{ marginLeft: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Avatar name={me.full_name} size={34} />
        {wide && (
          <View>
            <T size={13} weight="700">
              {me.full_name}
            </T>
            <T size={12} muted>
              {me.title || ROLES[me.role]}
            </T>
          </View>
        )}
      </Pressable>
    </Row>
  );
}

function BottomTabs() {
  const { c } = useTheme();
  const nav = useNav();
  const active = PARENT[nav.route.name] ?? nav.route.name;
  const inMore = !TABS.some((t) => t.name === active);
  return (
    <SafeAreaView edges={['bottom']} style={{ backgroundColor: c.surface, borderTopWidth: 1, borderColor: c.border }}>
      <Row style={{ height: 62 }} gap={0}>
        {TABS.map((t) => {
          const on = t.name === active || (t.name === 'more' && inMore);
          return (
            <Pressable key={t.name} onPress={() => nav.go({ name: t.name })} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
              <View style={{ paddingHorizontal: 16, paddingVertical: 4, borderRadius: 14, backgroundColor: on ? c.primarySoft : 'transparent' }}>
                <Ionicons name={on ? (t.icon.replace('-outline', '') as IconName) : t.icon} size={22} color={on ? c.primary : c.textMuted} />
              </View>
              <T size={11} weight={on ? '700' : '500'} color={on ? c.primary : c.textMuted}>
                {t.label}
              </T>
            </Pressable>
          );
        })}
      </Row>
    </SafeAreaView>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  const wide = useWide();
  const nav = useNav();
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: c.bg }}>
      {wide && <Sidebar />}
      <SafeAreaView edges={wide ? [] : ['top']} style={{ flex: 1, backgroundColor: c.surface }}>
        <TopBar onAvatar={() => nav.go({ name: 'settings' })} />
        <View style={{ flex: 1, backgroundColor: c.bg }}>{children}</View>
        {!wide && <BottomTabs />}
      </SafeAreaView>
      <ToastHost />
    </View>
  );
}
