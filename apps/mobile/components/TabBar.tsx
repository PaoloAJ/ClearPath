import { router, usePathname, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { colors, fonts, MIN_TAP_TARGET } from '@/lib/theme';

const tabs: { href: Href; path: string; label: string; icon: IconName }[] = [
  { href: '/', path: '/', label: 'Map', icon: 'tab-map' },
  { href: '/elevators', path: '/elevators', label: 'Elevators', icon: 'tab-elevators' },
  { href: '/report', path: '/report', label: 'Report', icon: 'tab-report' },
  { href: '/profile', path: '/profile', label: 'Profile', icon: 'tab-profile' },
];

/** Figma "Tab bar". The active tab also gets a top bar, so selection isn't shown by color alone (R6). */
export function TabBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityRole="tablist" style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {tabs.map((tab) => {
        const active = pathname === tab.path;
        const color = active ? colors.primary : colors.textMuted;
        return (
          <Pressable key={tab.label} accessibilityRole="tab" accessibilityLabel={tab.label}
            accessibilityState={{ selected: active }} onPress={() => { if (!active) router.navigate(tab.href); }}
            style={styles.tab}>
            <View style={[styles.indicator, active && styles.indicatorActive]} />
            <Icon name={tab.icon} size={24} tint={color} />
            <Text style={[styles.label, { color }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.hairline,
    paddingHorizontal: 8,
  },
  tab: { flex: 1, minHeight: MIN_TAP_TARGET + 10, alignItems: 'center', justifyContent: 'center', gap: 3, paddingTop: 5 },
  indicator: { position: 'absolute', top: 0, width: 32, height: 3, borderRadius: 2 },
  indicatorActive: { backgroundColor: colors.primary },
  label: { fontFamily: fonts.bold, fontSize: 12 },
});
