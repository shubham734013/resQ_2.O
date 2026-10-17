import { createHmac, randomBytes, createHash } from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const base32Encode = (buffer: Buffer): string => {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i] ?? 0;
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
};

export const base32Decode = (input: string): Buffer => {
  const cleanInput = input.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleanInput.length; i++) {
    const char = cleanInput[i];
    if (!char) continue;
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid Base32 character: ${char}`);
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
};

export const generateBase32Secret = (byteLength = 20): string => {
  return base32Encode(randomBytes(byteLength));
};

export const generateTotpCode = (secret: string, timeStep?: number): string => {
  const step = timeStep ?? Math.floor(Date.now() / 1000 / 30);
  const key = base32Decode(secret);

  const counter = Buffer.alloc(8);
  counter.writeBigInt64BE(BigInt(step), 0);

  const hmac = createHmac('sha1', key).update(counter).digest();
  const lastByte = hmac[hmac.length - 1] ?? 0;
  const offset = lastByte & 0x0f;

  const b0 = hmac[offset] ?? 0;
  const b1 = hmac[offset + 1] ?? 0;
  const b2 = hmac[offset + 2] ?? 0;
  const b3 = hmac[offset + 3] ?? 0;

  const binary =
    ((b0 & 0x7f) << 24) |
    ((b1 & 0xff) << 16) |
    ((b2 & 0xff) << 8) |
    (b3 & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
};

export interface TotpVerificationResult {
  valid: boolean;
  step?: number;
}

/**
 * Verify a 6-digit TOTP token against a Base32 secret with drift window tolerance.
 * Default window = 1 allows 30 seconds before and after the current window (90s total).
 */
export const verifyTotpCode = (secret: string, token: string, windowSteps = 1): TotpVerificationResult => {
  const cleanToken = token.trim();
  if (!/^\d{6}$/.test(cleanToken)) {
    return { valid: false };
  }

  const currentStep = Math.floor(Date.now() / 1000 / 30);

  for (let stepOffset = -windowSteps; stepOffset <= windowSteps; stepOffset++) {
    const step = currentStep + stepOffset;
    try {
      const expected = generateTotpCode(secret, step);
      if (expected === cleanToken) {
        return { valid: true, step };
      }
    } catch {
      return { valid: false };
    }
  }

  return { valid: false };
};

export const buildOtpauthUri = (secret: string, accountName: string, issuer = 'ResQ'): string => {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
};

export const generateRecoveryCodes = (count = 8): string[] => {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // 8 alphanumeric chars formatted as XXXX-XXXX (e.g. A3F8-92B1)
    const raw = randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}`);
  }
  return codes;
};

export const hashRecoveryCode = (code: string): string => {
  const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return createHash('sha256').update(normalized).digest('hex');
};
