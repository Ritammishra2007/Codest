import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

// Resolve relative to this file so direct Node commands work from any directory.
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
