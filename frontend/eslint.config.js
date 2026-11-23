// Lint rules for the frontend (ENG-1, ENG-2): TypeScript strict (which includes recommended),
// React Hooks recommended, accessibility recommended, and a complexity limit.
import jsxA11y from "eslint-plugin-jsx-a11y-x";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const noFetchOutsideApi = {
  // ENG-1: only src/api/ talks to the network.
  "no-restricted-globals": [
    "error",
    { name: "fetch", message: "Call the API through src/api/ (ENG-1)." },
    { name: "XMLHttpRequest", message: "Call the API through src/api/ (ENG-1)." },
  ],
  "no-restricted-properties": [
    "error",
    { object: "window", property: "fetch", message: "Call the API through src/api/ (ENG-1)." },
    { object: "globalThis", property: "fetch", message: "Call the API through src/api/ (ENG-1)." },
  ],
};

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**"] },
  ...tseslint.configs.strict,
  { ...jsxA11y.configs.recommended, files: ["**/*.tsx"] },
  // Keeps every function small enough to follow and test (STANDARDS.md: short functions).
  { rules: { complexity: ["error", 15] } },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...noFetchOutsideApi,
      // React escaping only: user text is never rendered as HTML (SEC-6).
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: "User text is always shown as text (SEC-6).",
        },
      ],
    },
  },
  {
    // The API layer may call fetch; its tests stub it.
    files: ["src/api/**"],
    rules: { "no-restricted-globals": "off", "no-restricted-properties": "off" },
  },
);
