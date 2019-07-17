// @flow
import type {Plugin} from '../types';
import uuid from 'uuid/v4';

const jobResponseUuidPlugin: Plugin = {
  beforeJob({jobRequest}) {
    jobRequest.metadata.uuid = uuid();
  },

  afterRender({jobRequest, jobResponse}) {
    jobResponse.metadata.uuid = jobRequest.metadata.uuid;
  }
};

export default jobResponseUuidPlugin;
