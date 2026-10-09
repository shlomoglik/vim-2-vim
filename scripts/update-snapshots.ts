import { writeFileSync } from 'node:fs';
import { captureBaseline } from '../test/helpers/baseline.js';

const baseline = captureBaseline();
writeFileSync(new URL('../test/fixtures/baseline.json', import.meta.url), JSON.stringify(baseline, null, 2) + '\n');
console.log(`Updated ${Object.keys(baseline.lessons).length} lesson and ${Object.keys(baseline.screens).length} screen fingerprints. Review the fixture diff before committing.`);
