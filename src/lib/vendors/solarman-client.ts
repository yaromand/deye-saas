import { createHash } from "crypto";
import type { VendorCredentials } from "./types";

export const SOLARMAN_BASE_CN = "https://api.solarmanpv.com";
export const SOLARMAN_BASE_GLOBAL = "https://globalapi.solarmanpv.com";

export type SolarmanDataItem = {
  key?: string;
  value?: string;
  unit?: string;
  name?: string;
};

type TokenResponse = {
  success?: boolean;
  code?: string | number;
  msg?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: string | number;
  uid?: number;
};

type DeviceListResponse = {
  success?: boolean;
  msg?: string;
  total?: number;
  deviceListItems?: Array<{
    deviceSn?: string;
    deviceId?: number;
    deviceType?: string;
    connectStatus?: number;
    collectionTime?: number;
  }>;
};

type StationListResponse = {
  success?: boolean;
  msg?: string;
  total?: number;
  stationListItems?: Array<{
    id?: number;
    name?: string;
    locationAddress?: string;
  }>;
};

type StationDevicesResponse = {
  success?: boolean;
  msg?: string;
  total?: number;
  deviceListItems?: Array<{
    deviceSn?: string;
    deviceId?: number;
    deviceType?: string;
    connectStatus?: number;
    collectionTime?: number;
  }>;
};

type CurrentDataResponse = {
  success?: boolean;
  msg?: string;
  deviceSn?: string;
  deviceId?: number;
  deviceState?: number;
  collectionTime?: number;
  dataList?: SolarmanDataItem[];
};

type HistoricalResponse = {
  success?: boolean;
  msg?: string;
  paramDataList?: Array<{
    collectionTime?: number;
    dataList?: SolarmanDataItem[];
  }>;
};

function sha256Lower(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function resolveBaseUrl(creds: VendorCredentials): string {
  const raw = creds.baseUrl?.trim();
  if (raw) return raw.replace(/\/$/, "");
  return SOLARMAN_BASE_GLOBAL;
}

async function solarmanFetch<T>(
  baseUrl: string,
  path: string,
  opts: {
    method?: string;
    query?: Record<string, string>;
    body?: unknown;
    token?: string;
  },
): Promise<T> {
  const url = new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  url.searchParams.set("language", "en");
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts.token) {
    headers.Authorization = `bearer ${opts.token}`;
  }

  const res = await fetch(url.toString(), {
    method: opts.method ?? "POST",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Solarman HTTP ${res.status} ${path}: ${text.slice(0, 200)}`,
    );
  }

  return (await res.json()) as T;
}

/** Obtain access_token; password is SHA-256 hashed per Solarman docs. */
export async function obtainToken(
  creds: VendorCredentials,
): Promise<{ accessToken: string; refreshToken?: string; uid?: number }> {
  if (creds.accessToken) {
    return {
      accessToken: creds.accessToken,
      refreshToken: creds.refreshToken,
    };
  }

  if (!creds.appId || !creds.appSecret || !creds.password) {
    throw new Error("appId, appSecret и password обязательны для получения token");
  }

  const body: Record<string, unknown> = {
    appSecret: creds.appSecret,
    password: sha256Lower(creds.password),
  };

  if (creds.email) body.email = creds.email;
  else if (creds.username) body.username = creds.username;
  else if (creds.mobile) {
    body.mobile = creds.mobile;
    if (creds.countryCode) body.countryCode = creds.countryCode;
  } else {
    throw new Error("Укажите email, username или mobile для Solarman");
  }

  if (creds.orgId) {
    const n = Number(creds.orgId);
    if (!Number.isNaN(n)) body.orgId = n;
  }

  const baseUrl = resolveBaseUrl(creds);
  const data = await solarmanFetch<TokenResponse>(
    baseUrl,
    "/account/v1.0/token",
    {
      query: { appId: creds.appId },
      body,
    },
  );

  if (!data.access_token) {
    throw new Error(
      `Solarman token error: ${data.msg ?? data.code ?? "no access_token"}`,
    );
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    uid: data.uid,
  };
}

export async function listStations(
  creds: VendorCredentials,
  token: string,
): Promise<StationListResponse["stationListItems"]> {
  const baseUrl = resolveBaseUrl(creds);
  const data = await solarmanFetch<StationListResponse>(
    baseUrl,
    "/station/v1.0/list",
    {
      token,
      body: { page: 1, size: 100 },
    },
  );
  if (data.success === false) {
    throw new Error(`Solarman station list: ${data.msg ?? "failed"}`);
  }
  return data.stationListItems ?? [];
}

export async function listDevicesForStation(
  creds: VendorCredentials,
  token: string,
  stationId: number,
): Promise<NonNullable<StationDevicesResponse["deviceListItems"]>> {
  const baseUrl = resolveBaseUrl(creds);
  const data = await solarmanFetch<StationDevicesResponse>(
    baseUrl,
    "/station/v1.0/device",
    {
      token,
      body: {
        stationId,
        deviceType: "INVERTER",
        page: 1,
        size: 100,
      },
    },
  );
  if (data.success === false) {
    throw new Error(`Solarman station devices: ${data.msg ?? "failed"}`);
  }
  return data.deviceListItems ?? [];
}

export async function listAllDevices(
  creds: VendorCredentials,
  token: string,
): Promise<NonNullable<DeviceListResponse["deviceListItems"]>> {
  const baseUrl = resolveBaseUrl(creds);
  const data = await solarmanFetch<DeviceListResponse>(
    baseUrl,
    "/device/v1.0/list",
    {
      token,
      body: { page: 1, size: 100 },
    },
  );
  if (data.success === false) {
    throw new Error(`Solarman device list: ${data.msg ?? "failed"}`);
  }
  return data.deviceListItems ?? [];
}

export async function fetchCurrentData(
  creds: VendorCredentials,
  token: string,
  deviceSn: string,
): Promise<CurrentDataResponse> {
  const baseUrl = resolveBaseUrl(creds);
  const data = await solarmanFetch<CurrentDataResponse>(
    baseUrl,
    "/device/v1.0/currentData",
    {
      token,
      body: { deviceSn },
    },
  );
  if (data.success === false) {
    throw new Error(`Solarman currentData: ${data.msg ?? "failed"}`);
  }
  return data;
}

export async function fetchHistoricalData(
  creds: VendorCredentials,
  token: string,
  deviceSn: string,
  startTime: string,
  endTime: string,
  timeType = 1,
): Promise<HistoricalResponse> {
  const baseUrl = resolveBaseUrl(creds);
  const data = await solarmanFetch<HistoricalResponse>(
    baseUrl,
    "/device/v1.0/historical",
    {
      token,
      body: { deviceSn, startTime, endTime, timeType },
    },
  );
  if (data.success === false) {
    throw new Error(`Solarman historical: ${data.msg ?? "failed"}`);
  }
  return data;
}

/** Map Solarman dataList keys → normalized metrics. */
export function parseDataList(items: SolarmanDataItem[] | undefined): {
  powerW?: number;
  energyKwh?: number;
  soc?: number;
  raw: Record<string, string>;
} {
  const raw: Record<string, string> = {};
  for (const item of items ?? []) {
    if (item.key && item.value != null) raw[item.key] = String(item.value);
  }

  const num = (...keys: string[]) => {
    for (const k of keys) {
      const v = raw[k];
      if (v == null || v === "") continue;
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
    return undefined;
  };

  // Common Solarman / Deye inverter keys (vary by device point table)
  let powerW = num(
    "Pac",
    "PpvTotal",
    "Ppvt",
    "OutputPower",
    "ActivePower",
    "generationPower",
    "Power",
  );
  // Some feeds are in kW
  if (powerW != null && powerW > 0 && powerW < 50 && raw.Pac == null) {
    // leave as-is if already watts-sized; heuristic: if unit was kW in name
  }
  const pacUnit = items?.find((i) => i.key === "Pac" || i.key === "Ppvt")?.unit;
  if (powerW != null && pacUnit?.toLowerCase() === "kw") {
    powerW = powerW * 1000;
  }

  const energyKwh = num(
    "Etdy_ge1",
    "Et_ge0",
    "Eday",
    "DailyEnergy",
    "generationValue",
    "Production",
    "E_Total",
    "Etoday",
  );

  const soc = num("SOC", "BatterySOC", "batterySoc", "Bms_Soc");

  return { powerW, energyKwh, soc, raw };
}

export function connectStatusToOnline(
  connectStatus: number | undefined,
): "online" | "offline" | "unknown" {
  // Solarman: 1 = online (docs vary; 0 offline / 1 online is common)
  if (connectStatus === 1) return "online";
  if (connectStatus === 0) return "offline";
  return "unknown";
}
