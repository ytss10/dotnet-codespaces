import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import importPlugin from "eslint-plugin-import";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";
import unusedImportsPlugin from "eslint-plugin-unused-imports";

const tsStrictRules = tsPlugin.configs["strict-type-checked"]?.rules ?? {};
const tsStylisticRules = tsPlugin.configs["stylistic-type-checked"]?.rules ?? {};

const reactRuleSet = {
  plugins: {
    react: reactPlugin,
    "react-hooks": reactHooksPlugin,
    "jsx-a11y": jsxA11yPlugin
  },
  settings: {
    react: {
      version: "detect"
    }
  },
  rules: {
    ...(reactPlugin.configs.recommended?.rules ?? {}),
    ...(reactPlugin.configs["jsx-runtime"]?.rules ?? {}),
    ...(reactHooksPlugin.configs.recommended?.rules ?? {}),
    ...(jsxA11yPlugin.configs.recommended?.rules ?? {}),
    "react/no-unused-prop-types": "warn",
    "react/jsx-max-depth": ["warn", { max: 6 }]
  }
};

export default [
  {
    ignores: ["node_modules/**", "dist/**", "coverage/**", "**/*.d.ts", "**/*.js", "**/*.cjs", "**/*.mjs"]
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        allowAutomaticSingleRunInference: true,
        projectService: true,
        tsconfigRootDir: new URL(".", import.meta.url).pathname
      },
      globals: {
        ...globals.node,
        ...globals.browser
      }
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      import: importPlugin,
      "unused-imports": unusedImportsPlugin
    },
    rules: {
      ...tsStrictRules,
      ...tsStylisticRules,
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-inferrable-types": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "warn",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_"
        }
      ],
      "import/no-unresolved": ["error", { commonjs: true, caseSensitive: true }],
      "import/order": [
        "warn",
        {
          groups: [["builtin", "external"], ["internal"], ["parent", "sibling", "index"]],
          alphabetize: { order: "asc", caseInsensitive: true },
          "newlines-between": "always"
        }
      ]
    }
  },
  {
    files: ["apps/**/*.tsx", "apps/**/*.ts", "packages/**/*.tsx"],
    ...reactRuleSet
  },
  {
    files: ["apps/orchestrator/**/*.ts"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node
    },
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }]
    }
  }
];
