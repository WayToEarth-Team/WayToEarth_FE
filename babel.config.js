module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@app': './src/app',
            '@features': './src/features',
            '@shared': './src/shared',
            '@utils': './utils',
            '@types': './types',
            '@assets': './assets',
            '@hooks': './hooks',
            '@contexts': './contexts',
            '@navigation': './navigation',
          },
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        },
      ],
      // Reanimated must be listed last
      'react-native-reanimated/plugin',
    ],
  };
};
