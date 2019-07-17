// @flow

import type {Plugin} from '../types.js';
import logger from '../utils/logger';

const plugin: Plugin = {
  beforeBatch() {
    logger.debug(`beforeBatch`);
  },
  beforeJob({jobRequest}) {
    logger.debug(`beforeJob. Name: ${jobRequest.name}`);
  },
  beforeLoadModule({jobRequest}) {
    logger.debug(`beforeLoadModule. Name: ${jobRequest.name}`);
  },
  afterLoadModule({jobRequest}) {
    logger.debug(`afterLoadModule. Name: ${jobRequest.name}`);
  },
  beforeRender({jobRequest}) {
    logger.debug(`beforeRender. Name: ${jobRequest.name}`);
  },
  afterRender({jobRequest}) {
    logger.debug(`afterRender. Name: ${jobRequest.name}`);
  },
  afterJob({jobRequest}) {
    logger.debug(`afterJob. Name: ${jobRequest.name}`);
  },
  afterBatch() {
    logger.debug(`afterBatch`);
  }
};

export default plugin;
