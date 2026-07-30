import "server-only";
import { createPublicKey, verify as cryptoVerify, type KeyObject } from "crypto";

// Fixed DER prefix wrapping a raw secp256k1 point into an SPKI public key:
// SEQUENCE { SEQUENCE { OID id-ecPublicKey, OID secp256k1 }, BIT STRING <point> }
const SECP256K1_SPKI_PREFIX = Buffer.from("3056301006072a8648ce3d020106052b8104000a034200", "hex");
const UNCOMPRESSED_POINT_LENGTH = 65; // 0x04 prefix + 32-byte X + 32-byte Y

interface BankSyncResponse {
  serverKeyId: string;
  serverPubKey: string; // base64, uncompressed secp256k1 point
  serverTimeMsec: number;
}

interface CachedKey {
  keyId: string;
  publicKey: KeyObject;
}

let cachedKey: CachedKey | null = null;

async function fetchBankKey(): Promise<CachedKey> {
  const res = await fetch("https://api.monobank.ua/bank/sync", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`bank/sync fetch failed: ${res.status}`);
  }
  const data: BankSyncResponse = await res.json();
  const pointBytes = Buffer.from(data.serverPubKey, "base64");
  if (pointBytes.length !== UNCOMPRESSED_POINT_LENGTH || pointBytes[0] !== 0x04) {
    throw new Error("bank/sync returned an unexpected public key format");
  }
  const spki = Buffer.concat([SECP256K1_SPKI_PREFIX, pointBytes]);
  const publicKey = createPublicKey({ key: spki, format: "der", type: "spki" });
  return { keyId: data.serverKeyId, publicKey };
}

async function getBankKey(expectedKeyId?: string): Promise<CachedKey> {
  if (cachedKey && (!expectedKeyId || cachedKey.keyId === expectedKeyId)) {
    return cachedKey;
  }
  cachedKey = await fetchBankKey();
  return cachedKey;
}

function verifyWithKey(publicKey: KeyObject, body: Buffer, signature: Buffer): boolean {
  if (cryptoVerify("sha256", body, { key: publicKey, dsaEncoding: "der" }, signature)) return true;
  if (signature.length === 64) {
    return cryptoVerify("sha256", body, { key: publicKey, dsaEncoding: "ieee-p1363" }, signature);
  }
  return false;
}

/** Verifies a Monobank webhook body against its X-Sign header, refetching
 *  the bank's public key if X-Key-Id doesn't match what's cached (key
 *  rotation). Mono signs with ECDSA over secp256k1, SHA-256 digest, in
 *  either raw r||s or ASN.1 DER encoding. */
export async function verifyMonobankWebhook(body: Buffer, xSign: string, xKeyId: string): Promise<boolean> {
  let signature: Buffer;
  try {
    signature = Buffer.from(xSign, "base64");
  } catch {
    return false;
  }

  try {
    const key = await getBankKey(xKeyId);
    if (verifyWithKey(key.publicKey, body, signature)) return true;
    // Key may have just rotated — force a refresh once and retry.
    cachedKey = null;
    const freshKey = await getBankKey(xKeyId);
    return verifyWithKey(freshKey.publicKey, body, signature);
  } catch {
    return false;
  }
}
