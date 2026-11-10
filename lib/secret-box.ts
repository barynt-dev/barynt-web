import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

// Secrets Barynt has to use again later (a plugin directory's access token,
// BARY-141), sealed before they reach the database: AES-256-GCM, a fresh IV
// per value, the key derived from `AUTH_SECRET` — no extra variable to set.
// A database dump alone reveals nothing; changing `AUTH_SECRET` makes every
// sealed value unreadable, and those secrets have to be entered again.
//
// Format: `v1.<iv>.<tag>.<ciphertext>`, each part base64url. The version
// lets the scheme change without guessing what an old value is.

const VERSION = "v1";

/** The key for `purpose`. Distinct purposes never share a key. */
function keyFor(purpose: string): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("AUTH_SECRET must be set (32+ characters) to seal secrets");
  return Buffer.from(
    hkdfSync(
      "sha256",
      secret,
      "barynt-secret-box",
      `${VERSION}:${purpose}`,
      32,
    ),
  );
}

/** Seals `plain` for `purpose` (e.g. "plugin-source-token"). */
export function sealSecret(plain: string, purpose: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFor(purpose), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [
    VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    body.toString("base64url"),
  ].join(".");
}

/**
 * Opens a value sealed for `purpose` — `null` when it can't be: another
 * purpose, a changed `AUTH_SECRET`, a tampered or unknown value. Never
 * throws for a bad value; a missing `AUTH_SECRET` still does.
 */
export function openSecret(sealed: string, purpose: string): string | null {
  const parts = sealed.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  const key = keyFor(purpose);
  try {
    const [, iv, tag, body] = parts.map((p) => Buffer.from(p, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    return null;
  }
}
