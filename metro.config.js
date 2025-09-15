const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add resolver configuration for React Native networking
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Add polyfills for better network compatibility
config.resolver.assetExts.push('bin');

module.exports = config;