/**
 * Encryption for the offline queue (`docs/08-offline-driver.md`: "encrypted
 * local storage, remote wipe").
 *
 * The queue holds signatures, photographs and customer addresses, so it must not
 * sit in IndexedDB in the clear — a shared handset or a stolen one would leak
 * the day's drops to whoever opens devtools.
 *
 * The key is generated once per install and stored as a **non-extractable**
 * `CryptoKey`. That property is the point: the browser will use the key to
 * decrypt, but JavaScript cannot read its raw bytes, so a script injected into
 * the page cannot exfiltrate the key and decrypt the queue offline later. The
 * key never leaves the device and is never derived from anything guessable.
 *
 * AES-GCM is authenticated, so a tampered record fails to decrypt rather than
 * yielding a wrong event that would then be synced as fact.
 */
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_BYTES = 12;

/** A record as it sits in IndexedDB: the IV beside the sealed bytes. */
export interface SealedRecord {
  iv: Uint8Array<ArrayBuffer>;
  ciphertext: ArrayBuffer;
}

export function queueCryptoAvailable(): boolean {
  return typeof globalThis.crypto?.subtle?.encrypt === 'function';
}

/** Generates the per-install key. Not extractable, so JS cannot read it back. */
export async function generateQueueKey(): Promise<CryptoKey> {
  return globalThis.crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function seal(key: CryptoKey, value: unknown): Promise<SealedRecord> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await globalThis.crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, plaintext);
  return { iv, ciphertext };
}

export async function unseal<T>(key: CryptoKey, record: SealedRecord): Promise<T> {
  const plaintext = await globalThis.crypto.subtle.decrypt(
    { name: ALGORITHM, iv: record.iv },
    key,
    record.ciphertext,
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}
