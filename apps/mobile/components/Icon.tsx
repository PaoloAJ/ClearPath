import { Image } from 'expo-image';
import { View } from 'react-native';

// Exported from the Figma prototype's component library (assets/icons).
const icons = {
  'add-photo-camera': require('@/assets/icons/add-photo-camera.svg'),
  'alert-mark': require('@/assets/icons/alert-mark.svg'),
  'alert-triangle': require('@/assets/icons/alert-triangle.svg'),
  back: require('@/assets/icons/back.svg'),
  'checkbox-check': require('@/assets/icons/checkbox-check.svg'),
  'chevron-right': require('@/assets/icons/chevron-right.svg'),
  'chip-out': require('@/assets/icons/chip-out.svg'),
  'chip-unconfirmed': require('@/assets/icons/chip-unconfirmed.svg'),
  'chip-working': require('@/assets/icons/chip-working.svg'),
  destination: require('@/assets/icons/destination.svg'),
  'expiry-clock': require('@/assets/icons/expiry-clock.svg'),
  'fact-check': require('@/assets/icons/fact-check.svg'),
  'fact-clock': require('@/assets/icons/fact-clock.svg'),
  'fact-people': require('@/assets/icons/fact-people.svg'),
  gps: require('@/assets/icons/gps.svg'),
  'gps-note': require('@/assets/icons/gps-note.svg'),
  'nav-down': require('@/assets/icons/nav-down.svg'),
  'nav-up': require('@/assets/icons/nav-up.svg'),
  'photo-camera': require('@/assets/icons/photo-camera.svg'),
  'pin-bricks': require('@/assets/icons/pin-bricks.svg'),
  'pin-construction': require('@/assets/icons/pin-construction.svg'),
  'pin-elevator-out': require('@/assets/icons/pin-elevator-out.svg'),
  plus: require('@/assets/icons/plus.svg'),
  'radio-selected': require('@/assets/icons/radio-selected.svg'),
  search: require('@/assets/icons/search.svg'),
  'tab-elevators': require('@/assets/icons/tab-elevators.svg'),
  'tab-map': require('@/assets/icons/tab-map.svg'),
  'tab-profile': require('@/assets/icons/tab-profile.svg'),
  'tab-report': require('@/assets/icons/tab-report.svg'),
  'toast-check': require('@/assets/icons/toast-check.svg'),
  'tile-blocked': require('@/assets/icons/tile-blocked.svg'),
  'tile-construction': require('@/assets/icons/tile-construction.svg'),
  'tile-crowd': require('@/assets/icons/tile-crowd.svg'),
  'tile-elevator-out': require('@/assets/icons/tile-elevator-out.svg'),
  'tile-entrance': require('@/assets/icons/tile-entrance.svg'),
  'tile-rough': require('@/assets/icons/tile-rough.svg'),
  'you-dot': require('@/assets/icons/you-dot.svg'),
  'you-enroute': require('@/assets/icons/you-enroute.svg'),
  'you-enroute-halo': require('@/assets/icons/you-enroute-halo.svg'),
  'you-halo': require('@/assets/icons/you-halo.svg'),
} as const;

export type IconName = keyof typeof icons;

/** Decorative icon. The control or text next to it carries the accessible name. */
export function Icon({ name, size, tint }: { name: IconName; size: number; tint?: string }) {
  return (
    <Image
      source={icons[name]}
      style={{ width: size, height: size }}
      tintColor={tint}
      contentFit="contain"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

/**
 * Figma "Icon/alert". It exports as two vectors, so they're placed at their positions in the
 * 24 × 24 icon frame rather than merged into a new drawing.
 */
export function AlertIcon({ size }: { size: number }) {
  const k = size / 24;
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ position: 'absolute', left: 0.9 * k, top: 1.9 * k }}>
        <Image source={icons['alert-triangle']} style={{ width: 22.2 * k, height: 20.2 * k }} contentFit="fill" accessible={false} />
      </View>
      <View style={{ position: 'absolute', left: 10.9 * k, top: 8.9 * k }}>
        <Image source={icons['alert-mark']} style={{ width: 2.2 * k, height: 10.7 * k }} contentFit="fill" accessible={false} />
      </View>
    </View>
  );
}
