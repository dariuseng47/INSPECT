import crypto from 'crypto';

import { env } from '../config/env.js';

// Deterministic (keyed) hash, not bcrypt — PIN login needs to look up which user a
// submitted PIN belongs to via a single indexed query, and the DB enforces "no two users
// share a PIN" via a UNIQUE constraint on this column. bcrypt's per-record random salt
// makes both of those impossible (same input never hashes the same way twice), so a
// server-side pepper + HMAC is used instead. This does not make a 6-digit PIN itself
// stronger — brute-force resistance comes from rate-limiting the login endpoint, not the
// hash (see pinLoginRateLimiter in middleware/security.js).
export function hashPin(pin) {
  return crypto.createHmac('sha256', env.PIN_PEPPER).update(pin).digest('hex');
}
