'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { TextEncoder, TextDecoder } = require('node:util');

function makeSecurityModule() {
  const context = {
    crypto: webcrypto,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    Array,
    Set,
    Map,
    Date,
    Promise,
    URL,
    btoa,
    atob,
    console,
    setTimeout,
    clearTimeout
  };
  context.window = context;
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'security.js'), 'utf8');
  vm.runInNewContext(source, context, { filename: 'security.js' });
  return context.NoorSecurity;
}

test('encrypts and decrypts a snapshot without exposing its plaintext', async () => {
  const security = makeSecurityModule();
  const passphrase = 'Long distinct test passphrase 2026!';
  const prepared = await security.prepareSetup(passphrase);
  security.activate(prepared.key, 'owner@example.test', prepared.wrap_salt, prepared.wrapped_key, 0, false);

  const snapshot = {
    app: 'noor',
    marker: 'confidential-personal-planning-data',
    data: { settings: { vision: 'private goal' }, tasks: [{ title: 'secret task' }] }
  };
  const envelope = await security.encryptPayload(snapshot);

  assert.equal(envelope.encrypted, true);
  assert.equal(envelope.v, 1);
  assert.equal(JSON.stringify(envelope).includes(snapshot.marker), false);
  assert.equal(JSON.stringify(envelope).includes('secret task'), false);
  assert.equal(
    JSON.stringify(await security.decryptPayload(envelope)),
    JSON.stringify(snapshot)
  );
});

test('password-wrapped data key cannot be unlocked with a different passphrase', async () => {
  const security = makeSecurityModule();
  const passphrase = 'Long distinct test passphrase 2026!';
  const prepared = await security.prepareSetup(passphrase);
  const meta = {
    email: 'owner@example.test',
    wrap_salt: prepared.wrap_salt,
    wrapped_key: prepared.wrapped_key,
    revision: 0
  };

  await assert.rejects(
    security.unlockFromPassword('A wrong passphrase 2026!', meta, false)
  );

  await security.unlockFromPassword(passphrase, meta, false);
  assert.equal(security.isUnlocked(), true);
  assert.equal(security.getEmail(), 'owner@example.test');
});

test('authenticated encryption detects ciphertext tampering', async () => {
  const security = makeSecurityModule();
  const prepared = await security.prepareSetup('Long distinct test passphrase 2026!');
  security.activate(prepared.key, 'owner@example.test', prepared.wrap_salt, prepared.wrapped_key, 0, false);
  const envelope = await security.encryptPayload({ app: 'noor', data: 'test' });
  const first = envelope.ciphertext.slice(0, 1);
  const changed = first === 'A' ? 'B' : 'A';
  const tampered = Object.assign({}, envelope, {
    ciphertext: changed + envelope.ciphertext.slice(1)
  });

  await assert.rejects(security.decryptPayload(tampered));
});
