// @flow
const {exec, execSync} = require('child_process');

const ERROR_HEADER_REGEXP = /\S*Error\s-\S+\s\S*/gm;
const DIST_PATH_REGEXP = /packages\/\S+\/dist\//;
const ERRORS_COUNT_REGEXP = /\nFound\s([0-9]+)\serrors?/;
// We don't want to display these lines and spam terminal
const IGNORE_FLOW_LINES = ['Started a new flow server:', 'Please wait.'];

// Default flags
const DEFAULT_FLAGS = {
  ignore: DIST_PATH_REGEXP,
  color: 'always'
};

// Skip the first two args
const cliFlags = process.argv.slice(2);

// Process user passed flags
const cliFlagsMap = cliFlags.reduce((acc, flag) => {
  const [name, value] = flag.split('=');

  // We're picky about our flags and they should start with "--"
  if (!name.startsWith('--')) {
    return acc;
  }

  acc[name.slice(2)] = value;
  return acc;
}, {});

const flags = {...DEFAULT_FLAGS, ...cliFlagsMap};

// Simple helper to get number of errors string
const getFoundErrorsMessage = (count = 0) =>
  `Found ${count} error${count === 1 ? '' : 's'}`;

// Kick off Flow process
const flowProcess = exec(`npx flow --color=${flags.color}`);

// Will contain actual Flow errors about our code.
let fullReport = '';

// We don't want to receive messages as uint buffers
flowProcess.stdout.setEncoding('utf8');
flowProcess.stderr.setEncoding('utf8');

// Fun: https://github.com/facebook/flow/blob/master/src/common/flowExitStatus.ml#L76
flowProcess.on('exit', exitCode => {
  // If exit code is 0 - we have no errors.
  if (exitCode === 0) {
    console.log(getFoundErrorsMessage());
  }

  /**
   * If exit code is greater than 2, this means it's a Flow internal
   * error / warning and we can't proceed.
   */
  if (exitCode > 2) {
    // Warning itself is logged with flowProcess.stderr.on('data', cb).
    process.exit(exitCode);
  }

  // If it's a type error and report is not empty
  if (exitCode === 2 && fullReport) {
    const errorsToPrint = [];
    // Since some files may be ignored - we'll manually count errors
    const report = fullReport.replace(ERRORS_COUNT_REGEXP, '');
    // Get all of the error headers, they contain file path
    const errorHeaders = report.match(ERROR_HEADER_REGEXP);
    const errorsCount = errorHeaders.length;

    for (let i = 0; i < errorsCount; i++) {
      const errorHeader = errorHeaders[i];
      // skip errors that ignorePath RegExp
      if (flags.ignore.test(errorHeader)) {
        continue;
      }

      const errorHeaderPosition = report.indexOf(errorHeader);

      if (i + 1 !== errorsCount) {
        /**
         * To know where the current error ends, we need to know where the next
         * error header starts.
         */
        const nextErrorHeaderPosition = report.indexOf(errorHeaders[i + 1]);
        errorsToPrint.push(
          report.substring(errorHeaderPosition, nextErrorHeaderPosition)
        );
      } else {
        errorsToPrint.push(report.substring(errorHeaderPosition));
      }
    }

    if (!errorsToPrint.length) {
      /**
       * Flow found errors but all of them were skipped (matched ignore path).
       * Since we don't care about those - we'll exit with 0 code.
       */
      console.log(getFoundErrorsMessage());
      process.exit(0);
    }

    /**
     * If we have errors to print:
     * 1. add "Found X errors" line;
     * 2. join and print the errors.
     */
    const errorsFoundMessage = getFoundErrorsMessage(errorsToPrint.length);
    errorsToPrint.push(errorsFoundMessage);
    console.log(errorsToPrint.join(''));

    // Use the exit code provided by Flow.
    process.exit(exitCode);
  }
});

// Flow's internal messages / warnings will be logged here
flowProcess.stderr.on('data', msg => {
  // We don't care about some lines
  const shouldIgnoreLine = IGNORE_FLOW_LINES.some(line => msg.startsWith(line));

  if (shouldIgnoreLine) {
    return;
  }

  console.log(msg);
});

flowProcess.stdout.on(
  'data',
  reportDataBatch => (fullReport += reportDataBatch)
);

flowProcess.stdout.on('error', err =>
  console.error(`\nUnexpected Flow error:\n\n\t${err}`)
);

process.on('exit', () => {
  /**
   * Synchronously stop Flow server and it's child processes when in CI to
   * allow pipelines to finish.
   */
  if (process.env.CI) {
    process.stdout.write('\n');
    /**
     * If Flow server can't be stopped - the job will fail.
     *
     * We don't want stuck Flow processes to degrade overall pipelines
     * perfrormance by reporting them as "in use".
     *
     * The actual error will be thrown by execSync and will appear in stderr.
     */
    execSync('npx flow stop');
  }
});
