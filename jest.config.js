/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/index.ts",
  ],
  coverageDirectory: "coverage",
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|nativewind|react-native-css)",
  ],
  moduleNameMapper: {
    "\\.css$": "<rootDir>/src/__mocks__/css.js",
    "^@expo/vector-icons$": "<rootDir>/src/__mocks__/expo-vector-icons.tsx",
    "^@expo/vector-icons/(.*)$":
      "<rootDir>/src/__mocks__/expo-vector-icons.tsx",
    "^expo-router$": "<rootDir>/src/__mocks__/expo-router.tsx",
    "^expo-secure-store$": "<rootDir>/src/__mocks__/expo-secure-store.ts",
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@components/(.*)$": "<rootDir>/src/components/$1",
    "^@hooks/(.*)$": "<rootDir>/src/hooks/$1",
    "^@lib/(.*)$": "<rootDir>/src/lib/$1",
    "^@stores/(.*)$": "<rootDir>/src/stores/$1",
    "^@types/(.*)$": "<rootDir>/src/types/$1",
    "^@utils/(.*)$": "<rootDir>/src/utils/$1",
  },
};
