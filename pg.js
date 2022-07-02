// Variation of node_modules/pg/lib/index.js
// Disables loading of native implementation

import * as Client from './node_modules/pg/lib/client';
import * as BasicPool from 'pg-pool';

export * as defaults from './node_modules/pg/lib/defaults';
export * as Client from './node_modules/pg/lib/client';
export * as Connection from './node_modules/pg/lib/connection';
export {Query} from './node_modules/pg/lib/client';
export * as types from 'pg-types';

export class Pool extends BasicPool {
    constructor(options) {
        super(options, Client);
    }
}

export const _pools = [];
