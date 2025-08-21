module.exports = {
  // Line settings
  printWidth: {{PRINT_WIDTH}},
  tabWidth: {{TAB_WIDTH}},
  useTabs: {{USE_TABS}},
  
  // Punctuation
  semi: {{SEMICOLONS}},
  singleQuote: {{SINGLE_QUOTES}},
  quoteProps: '{{QUOTE_PROPS}}',
  trailingComma: '{{TRAILING_COMMA}}',
  bracketSpacing: {{BRACKET_SPACING}},
  arrowParens: '{{ARROW_PARENS}}',
  
  // JSX settings
  {{#JSX_SUPPORT}}jsxSingleQuote: {{JSX_SINGLE_QUOTES}},
  jsxBracketSameLine: {{JSX_BRACKET_SAME_LINE}},{{/JSX_SUPPORT}}
  
  // Other formatting
  endOfLine: '{{END_OF_LINE}}',
  embeddedLanguageFormatting: '{{EMBEDDED_LANGUAGE_FORMATTING}}',
  
  // File-specific overrides
  overrides: [
    {{#MARKDOWN_FORMATTING}}{
      files: '*.md',
      options: {
        printWidth: {{MARKDOWN_PRINT_WIDTH}},
        proseWrap: '{{MARKDOWN_PROSE_WRAP}}'
      }
    },{{/MARKDOWN_FORMATTING}}
    {{#JSON_FORMATTING}}{
      files: ['*.json', '*.jsonc'],
      options: {
        printWidth: {{JSON_PRINT_WIDTH}},
        tabWidth: {{JSON_TAB_WIDTH}}
      }
    },{{/JSON_FORMATTING}}
    {{#YAML_FORMATTING}}{
      files: ['*.yml', '*.yaml'],
      options: {
        tabWidth: {{YAML_TAB_WIDTH}},
        singleQuote: {{YAML_SINGLE_QUOTES}}
      }
    }{{/YAML_FORMATTING}}
  ]
};