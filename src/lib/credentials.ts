import { decryptSecret, encryptSecret } from "./crypto";
import type { VendorCredentials } from "./vendors/types";

export function encryptCredentials(creds: VendorCredentials): string {
  return encryptSecret(JSON.stringify(creds));
}

export function decryptCredentials(payload: string): VendorCredentials {
  const raw = decryptSecret(payload);
  return JSON.parse(raw) as VendorCredentials;
}

/** Never return secrets to the client — only presence flags / non-secret fields. */
export function publicCredentialHints(creds: VendorCredentials) {
  return {
    hasAppId: Boolean(creds.appId),
    hasAppSecret: Boolean(creds.appSecret),
    hasPassword: Boolean(creds.password),
    hasAccessToken: Boolean(creds.accessToken),
    email: creds.email ? maskEmail(creds.email) : undefined,
    username: creds.username ? maskMiddle(creds.username) : undefined,
    baseUrl: creds.baseUrl,
    stationId: creds.stationId,
    orgId: creds.orgId,
  };
}

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  const u = user.length <= 2 ? "*" : `${user[0]}***${user[user.length - 1]}`;
  return `${u}@${domain}`;
}

function maskMiddle(s: string): string {
  if (s.length <= 2) return "***";
  return `${s[0]}***${s[s.length - 1]}`;
}
