declare module "@expo/vector-icons" {
  import type { ComponentType } from "react";

  interface IconProps {
    name: string;
    size?: number;
    color?: string;
    style?: unknown;
    testID?: string;
  }

  export const Ionicons: ComponentType<IconProps> & {
    glyphMap: Record<string, number>;
  };

  export const MaterialIcons: ComponentType<IconProps>;
  export const FontAwesome: ComponentType<IconProps>;
}
