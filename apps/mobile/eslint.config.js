const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*'],
  },
  {
    // UI must talk to AudioEngine only — never import the native library directly.
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    ignores: ['src/audio/engine/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native-audio-api',
              message:
                'Import AudioEngine from @intell/shared / src/audio/engine instead of react-native-audio-api.',
            },
          ],
        },
      ],
    },
  },
]);
