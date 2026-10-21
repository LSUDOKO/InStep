// Metro for the Vega app. The shared InStep packages are plain TypeScript source in ../../packages,
// consumed directly (no build step); this app is installed with npm, outside the pnpm workspace.
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const packages = path.resolve(__dirname, '../../packages');
const local = (m) => path.resolve(__dirname, 'node_modules', m);

module.exports = mergeConfig(getDefaultConfig(__dirname), {
  watchFolders: [packages],
  resolver: {
    unstable_enableSymlinks: true,
    sourceExts: ['vega.tsx', 'vega.ts', 'tsx', 'ts', 'jsx', 'js', 'json'],
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
    extraNodeModules: {
      '@instep/istep-format': path.join(packages, 'istep-format/src'),
      '@instep/gate-engine': path.join(packages, 'gate-engine/src'),
      '@instep/protocol': path.join(packages, 'protocol/src'),
      '@instep/gated-player': path.join(packages, 'gated-player/src'),
      react: local('react'),
      'react-native': local('react-native'),
      'react-native-svg': local('@amazon-devices/react-native-svg'),
      zod: local('zod'),
    },
  },
});
