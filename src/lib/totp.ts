import "server-only";
import { Secret, TOTP } from "otpauth";
import QRCode from "qrcode";

const totp = (secret: string, label: string) =>
  new TOTP({ issuer: "Ecommerce Platform", label, algorithm: "SHA1", digits: 6, period: 30, secret: Secret.fromBase32(secret) });

export const newTotpSecret = () => new Secret({ size: 20 }).base32;

export function verifyTotp(secret: string, code: string, label = "admin") {
  const clean = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  return totp(secret, label).validate({ token: clean, window: 1 }) !== null;
}

export async function totpQr(secret: string, label: string) {
  const uri = totp(secret, label).toString();
  return { uri, dataUrl: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) };
}
