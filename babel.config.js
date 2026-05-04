module.exports = function (api) {
  api.cache(true);
  
  const plugins = [];
  
  if (api.env('production')) {
    plugins.push('transform-remove-console');
  }
  
  // react-native-reanimated/plugin MUST be the last plugin
  plugins.push('react-native-reanimated/plugin');

  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins,
  };
};