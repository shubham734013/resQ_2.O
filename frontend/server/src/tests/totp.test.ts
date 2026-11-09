import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateBase32Secret,
  generateTotpCode,
  verifyTotpCode,
  base32Encode,
  base32Decode,
  generateRecoveryCodes,
  hashRecoveryCode,
  buildOtpauthUri,
} from '../utils/totp.js';

test('TOTP Utilities', async (t) => {
  await t.test('Base32 encode and decode roundtrip', () => {
    const original = Buffer.from('HelloWorld123', 'utf8');
    const encoded = base32Encode(original);
    const decoded = base32Decode(encoded);
    assert.deepEqual(decoded, original);
  });

  await t.test('generates valid 6-digit TOTP codes and verifies correctly', () => {
    const secret = generateBase32Secret();
    assert.match(secret, /^[A-Z2-7]+$/);

    const code = generateTotpCode(secret);
    assert.match(code, /^\d{6}$/);

    const verification = verifyTotpCode(secret, code);
    assert.equal(verification.valid, true);
    assert.equal(typeof verification.step, 'number');
  });

  await t.test('rejects incorrect TOTP codes', () => {
    const secret = generateBase32Secret();
    const verification = verifyTotpCode(secret, '000000');
    // Note: unless current code is 000000, it must be false
    const current = generateTotpCode(secret);
    if (current !== '000000') {
      assert.equal(verification.valid, false);
    }
  });

  await t.test('rejects malformed codes', () => {
    const secret = generateBase32Secret();
    assert.equal(verifyTotpCode(secret, '123').valid, false);
    assert.equal(verifyTotpCode(secret, 'abcdef').valid, false);
    assert.equal(verifyTotpCode(secret, '').valid, false);
  });

  await t.test('builds valid otpauth URI', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const uri = buildOtpauthUri(secret, 'admin@resq.local', 'ResQ');
    assert.equal(
      uri,
      'otpauth://totp/ResQ:admin%40resq.local?secret=JBSWY3DPEHPK3PXP&issuer=ResQ&algorithm=SHA1&digits=6&period=30'
    );
  });

  await t.test('generates, normalizes and hashes recovery codes', () => {
    const codes = generateRecoveryCodes(8);
    assert.equal(codes.length, 8);
    codes.forEach((code) => {
      assert.match(code, /^[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{8}$/);
      const hash1 = hashRecoveryCode(code);
      const hash2 = hashRecoveryCode(code.toLowerCase().replace('-', ''));
      assert.equal(hash1, hash2);
    });
  });
});
