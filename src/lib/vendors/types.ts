export type VendorId = "solarman" | "deye" | "felicity" | (string & {});

/**
 * Credentials stored encrypted per vendor_account.
 * Solarman/Deye Open API (https://doc.solarmanpv.com):
 * - Required for live calls: appId, appSecret, password + (email | username | mobile)
 * - Optional: accessToken (skip login), baseUrl, orgId, stationId, countryCode
 * - Password is stored as entered; adapter SHA-256-hashes it only for the token request.
 */
export type VendorCredentials = {
  appId?: string;
  appSecret?: string;
  /** Account email (preferred login field for Solarman) */
  email?: string;
  username?: string;
  mobile?: string;
  countryCode?: string;
  password?: string;
  accessToken?: string;
  refreshToken?: string;
  /** China: https://api.solarmanpv.com — International (default): https://globalapi.solarmanpv.com */
  baseUrl?: string;
  orgId?: string;
  /** Optional: limit device discovery to one station */
  stationId?: string;
  extra?: Record<string, string>;
};

export type DeviceInfo = {
  externalDeviceId: string;
  name: string;
  model?: string;
  status?: "online" | "offline" | "unknown";
  meta?: Record<string, unknown>;
};

export type TelemetryPoint = {
  ts: Date;
  powerW?: number;
  energyKwh?: number;
  soc?: number;
  status?: string;
  metrics?: Record<string, unknown>;
};

/**
 * Vendor cloud adapter — UI and polling depend only on this interface.
 * No Modbus; cloud APIs only.
 */
export interface VendorAdapter {
  id: VendorId;
  /** Human-readable credential field hints for UI / README */
  credentialFields: {
    required: string[];
    optional: string[];
    notes: string;
  };
  validateCredentials(creds: VendorCredentials): Promise<boolean>;
  listDevices(creds: VendorCredentials): Promise<DeviceInfo[]>;
  fetchTelemetry(
    creds: VendorCredentials,
    deviceId: string,
    from: Date,
    to: Date,
  ): Promise<TelemetryPoint[]>;
  /** Latest snapshot for polling (preferred over full history). */
  fetchLatest?(
    creds: VendorCredentials,
    deviceId: string,
  ): Promise<TelemetryPoint | null>;
}

/** True when enough fields exist to attempt a live Solarman/Deye call. */
export function hasLiveSolarmanCredentials(creds: VendorCredentials): boolean {
  if (creds.accessToken) return true;
  const hasApp = Boolean(creds.appId && creds.appSecret && creds.password);
  const hasLogin = Boolean(creds.email || creds.username || creds.mobile);
  return hasApp && hasLogin;
}
