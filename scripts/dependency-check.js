// Referenced https://github.com/maxogden/dependency-check/blob/master/index.js
// Needed to be adjusted for lerna

// This will error if anything not in dependencies used. devDep = error

const dc = require('dependency-check');
const fs = require('fs');
const path = require('path');

const nodeRoot = process.cwd();

const isDirectory = source => fs.lstatSync(source).isDirectory();
const getDirectories = source =>
  fs
    .readdirSync(source)
    .map(name => path.join(source, name))
    .filter(isDirectory);

// ensure a dir has a package.json
const directories = getDirectories(path.join(nodeRoot, 'packages')).filter(
  source => fs.existsSync(`${source}/package.json`)
);

// Get package main, or the root index.js, or all bins
const getEntries = source => {
  const entries = [];
  const pkg = require(path.join(source, 'package.json'));

  const mainInitPath = path.join(source, pkg.main || 'index.js');
  const mainPath = mainInitPath.endsWith('.js')
    ? mainInitPath
    : path.join(mainInitPath, 'index.js');

  if (fs.existsSync(mainPath)) {
    entries.push(mainPath);
  }

  if (pkg.bin) {
    if (typeof pkg.bin === 'string') {
      entries.push(path.resolve(path.join(source, pkg.bin)));
    } else {
      Object.keys(pkg.bin).forEach(cmdName => {
        const cmd = pkg.bin[cmdName];
        entries.push(path.resolve(path.join(source, cmd)));
      });
    }
  }

  return entries;
};

// Ensure a dir has an entry, or else we cant do anything..
const dirsWithEntries = directories.filter(dir => getEntries(dir).length > 0);

Promise.all(
  dirsWithEntries.map(dir =>
    dc({
      path: dir,
      entries: getEntries(dir)
    })
  )
)
  .then(pkgs => {
    let success = true;

    pkgs.forEach(({package: pkg, used: deps}) => {
      const missing = dc.missing(pkg, deps, {
        excludeDev: true
      });

      if (missing.length > 0) {
        success = false;
        console.warn(`USING DEPS THAT ARE NOT IN PACKAGE.JSON!!`);
        console.warn(pkg.name, missing);
      }
    });

    if (success) {
      console.log('Dependencies checked!');
    }

    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.log('dependency-check script');
    console.error(err);
    process.exit(1);
  });
