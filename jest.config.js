/** @type {import('jest').Config} */
module.exports = {
  projects: [
    // ========================================
    // Project 1: Unit tests (existing config)
    // ========================================
    {
      displayName: "unit",
      preset: "jest-expo",
      testMatch: ["<rootDir>/src/**/*.test.{ts,tsx}"],
      collectCoverageFrom: [
        "src/**/*.{ts,tsx}",
        "!src/**/*.d.ts",
        "!src/**/index.ts",
      ],
      coverageDirectory: "coverage",
      transformIgnorePatterns: [
        "node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-native-google-signin)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|nativewind|react-native-css)",
      ],
      moduleNameMapper: {
        "\\.css$": "<rootDir>/src/__mocks__/css.js",
        "^@expo/vector-icons$": "<rootDir>/src/__mocks__/expo-vector-icons.tsx",
        "^@expo/vector-icons/(.*)$":
          "<rootDir>/src/__mocks__/expo-vector-icons.tsx",
        "^expo-router$": "<rootDir>/src/__mocks__/expo-router.tsx",
        "^expo-secure-store$": "<rootDir>/src/__mocks__/expo-secure-store.ts",
        "^react-native-reanimated$":
          "<rootDir>/src/__mocks__/react-native-reanimated.ts",
        "^@react-native-google-signin/google-signin$":
          "<rootDir>/src/__mocks__/@react-native-google-signin/google-signin.ts",
        "^@/(.*)$": "<rootDir>/src/$1",
        "^@components/(.*)$": "<rootDir>/src/components/$1",
        "^@hooks/(.*)$": "<rootDir>/src/hooks/$1",
        "^@lib/(.*)$": "<rootDir>/src/lib/$1",
        "^@stores/(.*)$": "<rootDir>/src/stores/$1",
        "^@types/(.*)$": "<rootDir>/src/types/$1",
        "^@utils/(.*)$": "<rootDir>/src/utils/$1",
        "^expo-image-picker$": "<rootDir>/src/__mocks__/expo-image-picker.ts",
      },
    },
    // ========================================
    // Project 2: Supabase integration tests
    // ========================================
    {
      displayName: "supabase",
      testEnvironment: "node",
      testMatch: ["<rootDir>/supabase/__tests__/**/*.test.ts"],
      transform: {
        "^.+\\.ts$": [
          "ts-jest",
          {
            tsconfig: {
              target: "es2020",
              module: "commonjs",
              esModuleInterop: true,
              strict: true,
              resolveJsonModule: true,
              skipLibCheck: true,
            },
          },
        ],
      },
    },
  ],
};
