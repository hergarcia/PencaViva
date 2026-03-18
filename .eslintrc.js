module.exports = {
  root: true,
  extends: [
    "expo",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended",
  ],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "import/no-unresolved": ["error", { ignore: ["^@expo/vector-icons$"] }],
  },
  ignorePatterns: ["node_modules/", "dist/", ".expo/", "coverage/"],
  overrides: [
    {
      // Deno Edge Functions use JSR/URL imports — skip Node resolver checks
      files: ["supabase/functions/**/*.ts"],
      rules: {
        "import/no-unresolved": "off",
      },
    },
  ],
};
