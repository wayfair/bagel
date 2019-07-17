module.exports = {
  babelrcRoots: ['.', 'packages/*'],
  presets: [
    [
      require.resolve('@babel/preset-env'),
      {
        targets: {
          node: '8'
        }
      }
    ],
    require.resolve('@babel/preset-flow')
  ],
  plugins: [require.resolve('babel-plugin-jest-hoist')]
};
