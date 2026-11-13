import { randomInt } from "node:crypto";

// Leaves out 0, O, 1, l and I so a password copied or read out by hand
// is not misread. 56 characters x 12 places is about 70 bits.
const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateTempPassword(length = 12): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}
