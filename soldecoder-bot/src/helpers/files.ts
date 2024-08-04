import * as path from 'node:path';
import * as url from 'node:url';

export const _dirname = path.dirname(url.fileURLToPath(import.meta.url));
