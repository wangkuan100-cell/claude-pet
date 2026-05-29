import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LINES, LINE_IDS, FORMS, lineFor } from '../src/lines.js';

test('there are 6 lines, each with all 6 forms', () => {
  assert.equal(LINE_IDS.length, 6);
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
  assert.equal(lineFor('nope'), null);
});
