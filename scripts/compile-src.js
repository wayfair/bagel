const {watch} = require('minimist')(process.argv.slice(2));
const cp = require('child_process');
const fs = require('fs');
const path = require('path');

const srcDirExists = fs.existsSync('src');
if (!srcDirExists) {
  process.exit(0);
}

const pathToBin = path.resolve('../../node_modules/.bin');
// @TODO this could probably be done via node api?

const babelCmd = `${pathToBin}/babel src \
    --out-dir dist \
    --source-maps inline \
    --ignore '**/__tests__/**/*' \
    --root-mode upward \
    --verbose \
    ${watch ? '--watch' : ''}`;

const flowCmd = `${pathToBin}/flow-copy-source src dist \
  --ignore '**/__tests__/**/*' \
  ${watch ? '--watch' : ''}`;

// The & rather than && is needed for watch mode for reasons we're
// a bit fuzzy on, but && works better in some cases. So only use
// & when we really need it.
const cmd = `${babelCmd} ${watch ? '&' : '&&'} ${flowCmd}`;
cp.execSync(cmd, {stdio: [0, 1, 2]});
