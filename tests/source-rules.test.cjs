'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../js/source-rules.js');

test('normalizes URL tracking parameters and fragments', () => {
  assert.equal(
    rules.normalizeUrl('https://www.youtube.com/watch?v=abc123&si=tracking&utm_source=mail#t=20'),
    'https://youtube.com/watch?v=abc123'
  );
});

test('classifies PDF URLs even when a separate title exists', () => {
  const source = rules.classifySource({
    url: 'https://example.org/files/notes.pdf?utm_campaign=test',
    title: 'ملاحظات المحاضرة'
  });
  assert.equal(source.type, 'PDF');
  assert.equal(source.needsReview, false);
  assert.equal(source.normalizedUrl, 'https://example.org/files/notes.pdf');
});

test('recognizes common video platforms as video sources', () => {
  const source = rules.classifySource({ url: 'https://youtu.be/xyz987?si=tracking' });
  assert.equal(source.type, 'فيديو');
  assert.equal(source.needsReview, false);
});

test('detects exact URL duplicates while disregarding tracking links', () => {
  const duplicates = rules.findDuplicateCandidates(
    { url: 'https://www.youtube.com/watch?v=xyz987&si=first', title: 'درس' },
    [{ id: 4, url: 'https://youtube.com/watch?v=xyz987&si=second', title: 'درس محفوظ' }]
  );
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].id, 4);
  assert.equal(duplicates[0].strength, 'exact-url');
});

test('rejects unsafe URL schemes and flags the item for review', () => {
  assert.equal(rules.normalizeUrl('javascript:alert(1)'), '');
  const source = rules.classifySource({ url: 'javascript:alert(1)' });
  assert.equal(source.needsReview, true);
  assert.equal(source.confidence, 'low');
});

test('link matches are suggestions and always require approval', () => {
  const suggestions = rules.suggestLinks(
    { title: 'JavaScript asynchronous patterns' },
    [{ id: 2, title: 'JavaScript performance' }],
    [{ id: 3, name: 'JavaScript async patterns for apps' }]
  );
  assert.equal(suggestions[0].kind, 'project');
  assert.equal(suggestions[0].id, 3);
  assert.equal(suggestions[0].requiresApproval, true);
  assert.equal(suggestions[0].reason, 'اقتراح آلي مبني على الكلمات المشتركة في العناوين فقط');
});

test('does not propose a link when there are no shared terms', () => {
  assert.deepEqual(
    rules.suggestLinks({ title: 'Quantum electrodynamics' }, [], [{ id: 1, name: 'Iraqi cooking' }]),
    []
  );
});
