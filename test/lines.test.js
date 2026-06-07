import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LINES, LINE_IDS, FORMS, lineFor, pickSpecies } from '../src/lines.js';

const EXPECTED_LINE_IDS = [
  'phoenix',
  'dragon',
  'kitsune',
  'cerberus',
  'sphinx',
  'golem',
  'unicorn',
  'griffin',
  'pegasus',
  'leviathan',
  'basilisk',
  'mandrake',
];

test('there are 12 random hatch lines, each with all 6 forms', () => {
  assert.deepEqual(LINE_IDS, EXPECTED_LINE_IDS);
  assert.deepEqual(FORMS, ['egg', 'hatchling', 'juvenile', 'adolescent', 'adult', 'legendary']);
  for (const id of LINE_IDS) {
    const line = LINES[id];
    assert.ok(line.name && line.emoji);
    for (const form of FORMS) {
      assert.ok(line.forms[form], `${id} missing ${form}`);
      assert.ok(line.forms[form].emoji, `${id}/${form} missing emoji`);
      assert.ok(line.forms[form].art.length > 5, `${id}/${form} missing art`);
    }
  }
});

test('phoenix line matches the spec example and lineFor works', () => {
  assert.equal(lineFor('phoenix').name, '凤凰');
  assert.equal(lineFor('phoenix').forms.legendary.emoji, '🔥');
  assert.equal(lineFor('unicorn').name, '独角兽');
  assert.equal(lineFor('mandrake').forms.legendary.emoji, '🌿');
  assert.equal(lineFor('nope'), null);
});

test('pickSpecies returns a line id, deterministic under an injected rng', () => {
  assert.equal(pickSpecies(() => 0), LINE_IDS[0]);
  assert.equal(pickSpecies(() => 0.999), LINE_IDS[LINE_IDS.length - 1]);
  assert.ok(LINE_IDS.includes(pickSpecies(() => 0.5)));
});
