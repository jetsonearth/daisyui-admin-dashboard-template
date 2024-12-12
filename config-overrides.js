// config-overrides.js
const path = require('path');
const { override, addWebpackAlias } = require('customize-cra');

module.exports = override(
  addWebpackAlias({
    '@': path.resolve(__dirname, 'src')
  }),
  (config) => {
    // Modify resolve to prefer .tsx and .ts extensions
    config.resolve.extensions = [
      '.tsx', 
      '.ts', 
      '.js', 
      '.jsx', 
      ...(config.resolve.extensions || [])
    ];

    return config;
  }
);