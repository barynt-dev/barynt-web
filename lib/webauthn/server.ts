import "server-only";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { isoBase64URL, isoUint8Array } from "@simplewebauthn/server/helpers";
import type { WebAuthnConfig } from "next-auth/providers/webauthn";

/**
 * `@auth/core`'s WebAuthn code (`lib/utils/webauthn-utils.js`) is written
 * against `@simplewebauthn/server` v9, even in its latest release. We run
 * v14, whose API changed under it in four places:
 *
 * - `userID` must be bytes — Auth.js passes a random string, which v14
 *   rejects outright, so every registration failed.
 * - `allowCredentials`/`excludeCredentials` take base64url ids, Auth.js
 *   passes raw bytes.
 * - `verifyAuthenticationResponse` wants `credential: { id, publicKey,
 *   counter, transports }` instead of v9's `authenticator`.
 * - `verifyRegistrationResponse` returns the new key under
 *   `registrationInfo.credential` (base64url id), Auth.js reads v9's flat
 *   `credentialID`/`credentialPublicKey`/`counter` as bytes.
 *
 * The provider's `simpleWebAuthn` option lets us swap the four functions,
 * so this file translates in both directions instead of patching
 * `node_modules`. What lands in the `Authenticator` table is byte-for-byte
 * the same as before (Auth.js base64-encodes it itself), so passkeys
 * registered under v9 keep working.
 */

/** A credential descriptor the way Auth.js builds it (v9 shape). */
interface LegacyDescriptor {
  id: Uint8Array<ArrayBuffer>;
  type?: string;
  transports?: string[];
}

/** The authenticator the way Auth.js passes it (v9 shape). */
interface LegacyAuthenticator {
  credentialID: Uint8Array<ArrayBuffer>;
  credentialPublicKey: Uint8Array<ArrayBuffer>;
  counter: number;
  transports?: string[];
}

const toDescriptor = ({ id, transports }: LegacyDescriptor) => ({
  id: isoBase64URL.fromBuffer(id),
  transports,
});

type RegistrationOptions = Parameters<typeof generateRegistrationOptions>[0];
type AuthenticationOptions = Parameters<
  typeof generateAuthenticationOptions
>[0];
type VerifyAuthenticationOptions = Parameters<
  typeof verifyAuthenticationResponse
>[0];

export const simpleWebAuthn = {
  generateRegistrationOptions: (
    options: Omit<RegistrationOptions, "userID" | "excludeCredentials"> & {
      userID?: string | Uint8Array<ArrayBuffer>;
      excludeCredentials?: LegacyDescriptor[];
    },
  ) =>
    generateRegistrationOptions({
      ...options,
      userID:
        typeof options.userID === "string"
          ? isoUint8Array.fromUTF8String(options.userID)
          : options.userID,
      // v9 fell back to the user name, v14 to an empty string — keep what
      // the passkey manager showed so far.
      userDisplayName: options.userDisplayName ?? options.userName,
      excludeCredentials: options.excludeCredentials?.map(toDescriptor),
    }),

  generateAuthenticationOptions: (
    options: Omit<AuthenticationOptions, "allowCredentials"> & {
      allowCredentials?: LegacyDescriptor[];
    },
  ) =>
    generateAuthenticationOptions({
      ...options,
      allowCredentials: options.allowCredentials?.map(toDescriptor),
    }),

  verifyAuthenticationResponse: ({
    authenticator,
    ...options
  }: Omit<VerifyAuthenticationOptions, "credential"> & {
    authenticator: LegacyAuthenticator;
  }) =>
    verifyAuthenticationResponse({
      ...options,
      credential: {
        id: isoBase64URL.fromBuffer(authenticator.credentialID),
        publicKey: authenticator.credentialPublicKey,
        counter: authenticator.counter,
        transports: authenticator.transports,
      },
    }),

  verifyRegistrationResponse: async (
    options: Parameters<typeof verifyRegistrationResponse>[0],
  ) => {
    const result = await verifyRegistrationResponse(options);
    if (!result.verified) return result;
    const { credential } = result.registrationInfo;
    return {
      ...result,
      registrationInfo: {
        ...result.registrationInfo,
        credentialID: isoBase64URL.toBuffer(credential.id),
        credentialPublicKey: credential.publicKey,
        counter: credential.counter,
      },
    };
  },
  // The provider's type takes v14's signatures at face value (it imports
  // them from whatever `@simplewebauthn/server` resolves to); Auth.js still
  // calls in the v9 shape these wrappers accept.
} as unknown as WebAuthnConfig["simpleWebAuthn"];
