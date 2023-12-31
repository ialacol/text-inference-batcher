module.exports = {
  ignorePatterns: ["**/dist/*.*"],
  extends: ["standard", "eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  rules: {
    indent: ["error", 2],
    "linebreak-style": ["error", "unix"],
    quotes: ["error", "double"],
    semi: ["error", "always"],
    // fight with tsconfig's noUncheckedIndexedAccess
    "dot-notation": 0,
  },
};
