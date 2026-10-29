export type VendorId = "solarman" | "deye" | "felicity" | (string & {});

export type VendorCredentials = {
  /** App / API client id when applicable */
  appId?: string;
  appSecret?: string;
  /** Username / email for vendor cloud */
  username?: string;
  password?: string;
  /** Access / refresh tokens if already issued */
  accessToken?: string;
  refreshToken?: string;
  /** Opaque extras per vendor */
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
  validateCredentials(creds: VendorCredentials): Promise<boolean>;
  listDevices(creds: VendorCredentials): Promise<DeviceInfo[]>;
  fetchTelemetry(
    creds: VendorCredentials,
    deviceId: string,
    from: Date,
    to: Date,
  ): Promise<TelemetryPoint[]>;
}
