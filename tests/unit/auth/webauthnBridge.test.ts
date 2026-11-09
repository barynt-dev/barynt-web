import { describe, expect, it } from "bun:test";
import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  sign,
} from "node:crypto";
import { simpleWebAuthn } from "@/lib/webauthn/server";

// Auth.js calls the bridge in v9's shape; its public type is v14's.
// biome-ignore lint/suspicious/noExplicitAny: see above
const bridge = simpleWebAuthn as any;

const RP_ID = "barynt.test";
const ORIGIN = `https://${RP_ID}`;

// Auth.js' own helpers (`webauthn-utils.js`) — the `Authenticator` table
// stores standard base64, not base64url.
const toBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");
const fromBase64 = (b64: string) => new Uint8Array(Buffer.from(b64, "base64"));
const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");
const sha256 = (data: Uint8Array | string) =>
  new Uint8Array(createHash("sha256").update(data).digest());

/** Just enough CBOR for an attestation object and a COSE key. */
type Cbor = number | string | Uint8Array | Map<Cbor, Cbor>;
function cbor(value: Cbor): Uint8Array {
  const head = (major: number, n: number) =>
    n < 24
      ? [(major << 5) | n]
      : n < 256
        ? [(major << 5) | 24, n]
        : [(major << 5) | 25, n >> 8, n & 0xff];
  if (typeof value === "number")
    return new Uint8Array(value < 0 ? head(1, -1 - value) : head(0, value));
  if (typeof value === "string") {
    const bytes = new TextEncoder().encode(value);
    return new Uint8Array([...head(3, bytes.length), ...bytes]);
  }
  if (value instanceof Uint8Array)
    return new Uint8Array([...head(2, value.length), ...value]);
  const parts = [...value].flatMap(([k, v]) => [...cbor(k), ...cbor(v)]);
  return new Uint8Array([...head(5, value.size), ...parts]);
}

/** A software passkey: one ES256 key, attestation "none". */
function softwareAuthenticator() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
  });
  const jwk = publicKey.export({ format: "jwk" });
  const credentialId = new Uint8Array(randomBytes(32));
  const coseKey = cbor(
    new Map<Cbor, Cbor>([
      [1, 2], // kty: EC2
      [3, -7], // alg: ES256
      [-1, 1], // crv: P-256
      [-2, new Uint8Array(Buffer.from(jwk.x as string, "base64url"))],
      [-3, new Uint8Array(Buffer.from(jwk.y as string, "base64url"))],
    ]),
  );
  const UP_UV = 0x01 | 0x04;
  let counter = 0;
  const clientData = (type: string, challenge: string) =>
    new TextEncoder().encode(
      JSON.stringify({ type, challenge, origin: ORIGIN }),
    );
  const counterBytes = (n: number) =>
    new Uint8Array([n >>> 24, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);

  return {
    credentialId,
    create(challenge: string) {
      const authData = new Uint8Array([
        ...sha256(RP_ID),
        UP_UV | 0x40, // + attested credential data
        ...counterBytes(counter),
        ...new Uint8Array(16), // aaguid
        credentialId.length >> 8,
        credentialId.length & 0xff,
        ...credentialId,
        ...coseKey,
      ]);
      const attestationObject = cbor(
        new Map<Cbor, Cbor>([
          ["fmt", "none"],
          ["attStmt", new Map()],
          ["authData", authData],
        ]),
      );
      return {
        id: b64url(credentialId),
        rawId: b64url(credentialId),
        type: "public-key",
        clientExtensionResults: {},
        response: {
          clientDataJSON: b64url(clientData("webauthn.create", challenge)),
          attestationObject: b64url(attestationObject),
          transports: ["internal", "hybrid"],
        },
      };
    },
    get(challenge: string) {
      counter += 1;
      const authData = new Uint8Array([
        ...sha256(RP_ID),
        UP_UV,
        ...counterBytes(counter),
      ]);
      const clientDataJSON = clientData("webauthn.get", challenge);
      const signature = sign(
        "sha256",
        Buffer.concat([authData, sha256(clientDataJSON)]),
        privateKey,
      );
      return {
        id: b64url(credentialId),
        rawId: b64url(credentialId),
        type: "public-key",
        clientExtensionResults: {},
        response: {
          clientDataJSON: b64url(clientDataJSON),
          authenticatorData: b64url(authData),
          signature: b64url(signature),
        },
      };
    },
  };
}

describe("simpleWebAuthn bridge (Auth.js v9 calls → @simplewebauthn/server v14)", () => {
  it("accepts Auth.js' string userID and byte excludeCredentials", async () => {
    const excluded = new Uint8Array([1, 2, 3, 4]);
    const options = await bridge.generateRegistrationOptions({
      timeout: 1000,
      userID: "a".repeat(32),
      userName: "x@no-email.invalid",
      rpID: RP_ID,
      rpName: "Barynt",
      excludeCredentials: [
        { id: excluded, type: "public-key", transports: ["usb"] },
      ],
    });
    expect(options.user.id).toBe(
      b64url(new TextEncoder().encode("a".repeat(32))),
    );
    // v9's fallback, kept: the passkey manager shows the user name.
    expect(options.user.displayName).toBe("x@no-email.invalid");
    expect(options.excludeCredentials).toEqual([
      { id: b64url(excluded), type: "public-key", transports: ["usb"] },
    ]);
  });

  it("maps allowCredentials bytes to base64url", async () => {
    const id = new Uint8Array([9, 8, 7]);
    const options = await bridge.generateAuthenticationOptions({
      timeout: 1000,
      rpID: RP_ID,
      allowCredentials: [{ id, type: "public-key", transports: ["internal"] }],
    });
    expect(options.allowCredentials).toEqual([
      { id: b64url(id), type: "public-key", transports: ["internal"] },
    ]);
    // Discoverable sign-in (no email) sends no list at all.
    const userless = await bridge.generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: undefined,
    });
    expect(userless.allowCredentials).toBeUndefined();
  });

  it("registers and signs in a passkey end to end, the way Auth.js stores it", async () => {
    const device = softwareAuthenticator();

    // Registration — `getRegistrationOptions` + `verifyRegister`.
    const regOptions = await bridge.generateRegistrationOptions({
      userID: "b".repeat(32),
      userName: "ada@example.com",
      rpID: RP_ID,
      rpName: "Barynt",
    });
    const registration = await bridge.verifyRegistrationResponse({
      expectedChallenge: regOptions.challenge,
      response: device.create(regOptions.challenge),
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });
    expect(registration.verified).toBe(true);
    const info = registration.registrationInfo;
    // What `verifyRegister` writes into the `Authenticator` row.
    const row = {
      credentialID: toBase64(info.credentialID),
      credentialPublicKey: toBase64(info.credentialPublicKey),
      counter: info.counter,
      credentialBackedUp: info.credentialBackedUp,
      credentialDeviceType: info.credentialDeviceType,
      transports: "internal,hybrid",
    };
    expect(row.credentialID).toBe(toBase64(device.credentialId));
    expect(row.counter).toBe(0);

    // Sign-in — `getAuthenticationOptions` + `verifyAuthenticate`.
    const authOptions = await bridge.generateAuthenticationOptions({
      rpID: RP_ID,
    });
    const response = device.get(authOptions.challenge);
    // Auth.js looks the row up by `toBase64(fromBase64(response.id))`.
    expect(toBase64(fromBase64(response.id))).toBe(row.credentialID);
    const authentication = await bridge.verifyAuthenticationResponse({
      expectedChallenge: authOptions.challenge,
      response,
      authenticator: {
        ...row,
        credentialID: fromBase64(row.credentialID),
        credentialPublicKey: fromBase64(row.credentialPublicKey),
        transports: row.transports.split(","),
      },
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });
    expect(authentication.verified).toBe(true);
    expect(authentication.authenticationInfo.newCounter).toBe(1);
  });

  it("rejects a signature from a different key", async () => {
    const registered = softwareAuthenticator();
    const regOptions = await bridge.generateRegistrationOptions({
      userID: "c".repeat(32),
      userName: "ada@example.com",
      rpID: RP_ID,
      rpName: "Barynt",
    });
    const { registrationInfo } = await bridge.verifyRegistrationResponse({
      expectedChallenge: regOptions.challenge,
      response: registered.create(regOptions.challenge),
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });

    const impostor = softwareAuthenticator();
    const authOptions = await bridge.generateAuthenticationOptions({
      rpID: RP_ID,
    });
    const result = await bridge
      .verifyAuthenticationResponse({
        expectedChallenge: authOptions.challenge,
        response: impostor.get(authOptions.challenge),
        authenticator: {
          credentialID: registrationInfo.credentialID,
          credentialPublicKey: registrationInfo.credentialPublicKey,
          counter: 0,
        },
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
      })
      .catch(() => ({ verified: false }));
    expect(result.verified).toBe(false);
  });
});
