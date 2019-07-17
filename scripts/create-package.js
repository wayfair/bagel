const {
  _: [name]
} = require('minimist')(process.argv.slice(2));
const cp = require('child_process');
const path = require('path');
const fs = require('fs');

const author = cp
  .execSync('git config --global user.email')
  .toString()
  .trim();

const pjson = `{
  "name": "${name}",
  "version": "0.0.1",
  "description": "",
  "main": "dist/index.js",
  "scripts": {
    "build": "node ../../scripts/compile-src",
    "watch": "node ../../scripts/compile-src --watch"
  },
  "author": "${author || ''}",
  "license": "none",
  "dependencies": {}
}`;

const helloWorld = `console.log("hello world");`;

const installLocation = path.resolve(__dirname, '..', 'packages', name);
const srcLocation = path.resolve(installLocation, 'src');

fs.mkdirSync(installLocation);
fs.mkdirSync(srcLocation);
fs.writeFileSync(`${installLocation}/package.json`, pjson, 'utf8');
fs.writeFileSync(`${srcLocation}/index.js`, helloWorld, 'utf8');
cp.execSync('yarn && yarn build');
