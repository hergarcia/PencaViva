import React from "react";
import { Text } from "react-native";

function Ionicons({
  name,
  testID,
  ...props
}: {
  name: string;
  testID?: string;
  [key: string]: unknown;
}) {
  return (
    <Text testID={testID || `icon-${name}`} {...props}>
      {name}
    </Text>
  );
}

Ionicons.displayName = "Ionicons";

export { Ionicons };
export default Ionicons;
