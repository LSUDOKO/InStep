import { writeFileSync } from 'node:fs';
import { z } from 'zod';
import { IstepTrack } from '../src/schema';

const schema = z.toJSONSchema(IstepTrack, { target: 'draft-2020-12', io: 'input', unrepresentable: 'any' });
const out = {
  $id: 'https://github.com/LSUDOKO/InStep/schema/istep-1.0.schema.json',
  title: '.istep track v1.0',
  ...schema,
};
writeFileSync(
  new URL('../schema/istep-1.0.schema.json', import.meta.url),
  JSON.stringify(out, null, 2) + '\n',
);
console.log('wrote schema/istep-1.0.schema.json');
