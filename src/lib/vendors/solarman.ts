import type {
  DeviceInfo,
  TelemetryPoint,
  VendorAdapter,
  VendorCredentials,
} from "./types";

/**
 * Solarman / Deye cloud stub.
 * Real Open API calls land in a later phase — no secrets or live HTTP here.
 */
export const solarmanAdapter: VendorAdapter = {
  id: "solarman",

  async validateCredentials(creds: VendorCredentials): Promise<boolean> {
    // Stub: accept any non-empty credential set for local UI/dev flows
    const hasToken = Boolean(creds.accessToken);
    const hasApp = Boolean(creds.appId && creds.appSecret);
    const hasUser = Boolean(creds.username && creds.password);
    return hasToken || hasApp || hasUser;
  },

  async listDevices(_creds: VendorCredentials): Promise<DeviceInfo[]> {
    void _creds;
    return [
      {
        externalDeviceId: "stub-deye-001",
        name: "Инвертор (заглушка)",
        model: "Deye SUN-Stub",
        status: "unknown",
        meta: { stub: true },
      },
    ];
  },

  async fetchTelemetry(
    _creds: VendorCredentials,
    _deviceId: string,
    from: Date,
    to: Date,
  ): Promise<TelemetryPoint[]> {
    // Return a single synthetic point for scaffold wiring
    const mid = new Date((from.getTime() + to.getTime()) / 2);
    return [
      {
        ts: mid,
        powerW: 0,
        energyKwh: 0,
        status: "stub",
        metrics: { stub: true },
      },
    ];
  },
};

/** Deye often shares the Solarman Open API contour — separate id, same stub for now. */
export const deyeAdapter: VendorAdapter = {
  ...solarmanAdapter,
  id: "deye",
};
