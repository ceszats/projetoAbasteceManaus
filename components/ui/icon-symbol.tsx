// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  // Default
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  // FuelMap tabs
  "map.fill": "map",
  "list.bullet": "format-list-bulleted",
  "arrow.left.arrow.right": "compare-arrows",
  "arrow.clockwise": "refresh",
  "heart.fill": "favorite",
  "person.fill": "person",
  // FuelMap actions
  "location.fill": "my-location",
  "bell.fill": "notifications",
  "star.fill": "star",
  "star": "star-outline",
  "checkmark.circle.fill": "check-circle",
  "xmark.circle.fill": "cancel",
  "plus.circle.fill": "add-circle",
  "minus.circle.fill": "remove-circle",
  "arrow.up": "arrow-upward",
  "arrow.down": "arrow-downward",
  "clock.fill": "schedule",
  "person.2.fill": "group",
  "exclamationmark.triangle.fill": "warning",
  "exclamationmark.circle.fill": "error",
  "info.circle.fill": "info",
  "chevron.left": "chevron-left",
  "magnifyingglass": "search",
  "slider.horizontal.3": "tune",
  "car.fill": "directions-car",
  "fuelpump.fill": "local-gas-station",
  "trash.fill": "delete",
  "pencil": "edit",
  "xmark": "close",
  "checkmark": "check",
  "arrow.right": "arrow-forward",
  "drop.fill": "water-drop",
  "leaf.fill": "eco",
  "bolt.fill": "bolt",
  "chart.line.uptrend.xyaxis": "show-chart",
  "shield.fill": "verified",
  "wrench.fill": "build",
  "checkmark.seal.fill": "verified",
  "archivebox.fill": "inventory-2",
  "rectangle.portrait.and.arrow.right": "logout",
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name] ?? "help-outline"} style={style} />;
}
