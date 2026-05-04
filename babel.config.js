module.exports = function (api) {
  // Using api.env() automatically configures caching based on the environment.
  // We cannot use api.cache(true) because the config depends on the environment.
  const isProd = api.env('production');
  
  const plugins = [];
  
  if (isProd) {
    plugins.push('transform-remove-console');
  }
  
  // react-native-reanimated/plugin MUST be the absolute last plugin
  plugins.push('react-native-reanimated/plugin');

  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins,
  };
};