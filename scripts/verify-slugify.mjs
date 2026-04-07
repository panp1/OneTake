import assert from 'node:assert/strict';
import { slugify } from '../src/lib/slugify.ts';

const cases = [
  ['Project Cutis', 'project-cutis'],
  ['  Spaces  Everywhere  ', 'spaces-everywhere'],
  ['Already-slugified', 'already-slugified'],
  ['Emoji 🔥 Test', 'emoji-test'],
  ['Café Montréal', 'cafe-montreal'],
  ['UPPER CASE', 'upper-case'],
  ['multiple!!!!separators!!!', 'multiple-separators'],
  ['---leading-trailing---', 'leading-trailing'],
  ['', ''],
  ['!!!!!!', ''],
  ['a'.repeat(200), 'a'.repeat(60)],
  ['aa----', 'aa'],
  ['SJ-like-a-boss', 'sj-like-a-boss'],
];

for (const [input, expected] of cases) {
  const actual = slugify(input);
  assert.equal(actual, expected, `slugify(${JSON.stringify(input)}) = ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

console.log(`✓ ${cases.length} slugify assertions passed`);
