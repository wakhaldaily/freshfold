import { writeFileSync } from 'node:fs';
import { renderSchemaSql } from '../src/server/schema.js';

writeFileSync(new URL('../schema.sql', import.meta.url), renderSchemaSql());
console.log('schema.sql regenerated from src/server/schema.js');
