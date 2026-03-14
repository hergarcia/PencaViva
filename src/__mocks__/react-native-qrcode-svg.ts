import React from "react";
import { View } from "react-native";

const QRCode = ({ testID }: { testID?: string }) =>
  React.createElement(View, { testID: testID ?? "qr-code" });

export default QRCode;
