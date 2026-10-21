module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  // The shared packages and zod use ES2021+ syntax the RN 0.72 preset leaves as-is; transpile it for Hermes.
  plugins: [
    '@babel/plugin-transform-logical-assignment-operators',
    '@babel/plugin-transform-class-static-block',
  ],
};
