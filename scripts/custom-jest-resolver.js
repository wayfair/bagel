const defaultResolver = require('jest-resolve/build/defaultResolver').default;
const path = require('path');
const fs = require('fs');
//
// make it so require a monorepo package points to the src directory
// which is then compiled by custom-babel-jest instead of relying on dist from babel-watch

const packagesDir = path.join(__dirname, '../packages');
const localPackages = fs.readdirSync(packagesDir).reduce((acc, localDir) => {
  const fullPathLocalDir = path.join(packagesDir, localDir);

  if (fs.lstatSync(fullPathLocalDir).isDirectory()) {
    return [...acc, require(path.join(fullPathLocalDir, 'package.json')).name];
  } else {
    return acc;
  }
}, []);

module.exports = (moduleName, opts) => {
  if (localPackages.includes(moduleName)) {
    const pjson = require(defaultResolver(
      path.join(moduleName, 'package.json'),
      opts
    ));

    if (pjson.main) {
      return defaultResolver(
        path.join(moduleName, pjson.main.replace(/^dist/, 'src')),
        opts
      );
    }
  }

  return defaultResolver(moduleName, opts);
};
