export type MarkCoordinates = { lat: number | null; lng: number | null };

type EncryptedMarkCoordinates = {
  version: 1;
  iv: string;
  ciphertext: string;
};

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.length);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export function generatePrivateGpsKey(): string {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function importPrivateGpsKey(value: string): Promise<CryptoKey> {
  const bytes = decodeBase64Url(value.trim());
  if (bytes.length !== 32) throw new Error("The key must be 43 characters long.");
  return crypto.subtle.importKey("raw", toArrayBuffer(bytes), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptMarkCoordinates(key: CryptoKey, coordinates: MarkCoordinates): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(coordinates));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  const envelope: EncryptedMarkCoordinates = {
    version: 1,
    iv: encodeBase64Url(iv),
    ciphertext: encodeBase64Url(new Uint8Array(encrypted)),
  };
  return JSON.stringify(envelope);
}

export async function decryptMarkCoordinates(key: CryptoKey, value: string): Promise<MarkCoordinates> {
  const envelope = JSON.parse(value) as EncryptedMarkCoordinates;
  if (envelope.version !== 1 || typeof envelope.iv !== "string" || typeof envelope.ciphertext !== "string") {
    throw new Error("Invalid encrypted mark coordinates.");
  }

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(decodeBase64Url(envelope.iv)) },
    key,
    toArrayBuffer(decodeBase64Url(envelope.ciphertext))
  );
  const coordinates = JSON.parse(new TextDecoder().decode(plaintext)) as MarkCoordinates;
  const validLatitude = coordinates.lat === null || (typeof coordinates.lat === "number" && coordinates.lat >= -90 && coordinates.lat <= 90);
  const validLongitude = coordinates.lng === null || (typeof coordinates.lng === "number" && coordinates.lng >= -180 && coordinates.lng <= 180);
  if (!validLatitude || !validLongitude) throw new Error("Invalid decrypted mark coordinates.");
  return coordinates;
}