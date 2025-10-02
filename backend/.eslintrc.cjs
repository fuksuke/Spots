module.exports = {
  root: true,
  env: {
    node: true,
    es2020: true
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
    sourceType: "module"
  },
  plugins: ["@typescript-eslint", "import"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/typescript",
    "prettier"
  ],
  rules: {
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/consistent-type-imports": "warn",
    "import/order": [
      "warn",
      {
        "alphabetize": { order: "asc", caseInsensitive: true },
        "newlines-between": "always"
      }
    ]
  },
  ignorePatterns: ["dist", "node_modules"]
};
