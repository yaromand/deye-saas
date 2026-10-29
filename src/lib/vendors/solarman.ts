import {
  connectStatusToOnline,
  fetchCurrentData,
  fetchHistoricalData,
  listAllDevices,
  listDevicesForStation,
  listStations,
  obtainToken,
  parseDataList,
} from "./solarman-client";
import type {
  DeviceInfo,
  TelemetryPoint,
  VendorAdapter,
  VendorCredentials,
} from "./types";
import { hasLiveSolarmanCredentials } from "./types";

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function stubDevices(): DeviceInfo[] {
  return [
    {
      externalDeviceId: "stub-deye-001",
      name: "Инвертор (заглушка)",
      model: "Deye SUN-Stub",
      status: "online",
      meta: { stub: true },
    },
  ];
}

function stubLatest(deviceId: string): TelemetryPoint {
  const now = new Date();
  // Deterministic-ish synthetic curve for local UI without credentials
  const hour = now.getUTCHours() + now.getUTCMinutes() / 60;
  const solar = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
  const powerW = Math.round(solar * 4200 + Math.random() * 80);
  return {
    ts: now,
    powerW,
    energyKwh: Number((powerW / 1000).toFixed(3)),
    soc: 55 + Math.round(solar * 20),
    status: "stub",
    metrics: { stub: true, deviceId },
  };
}

function stubHistory(deviceId: string, from: Date, to: Date): TelemetryPoint[] {
  const points: TelemetryPoint[] = [];
  const stepMs = 60 * 60 * 1000;
  const start = from.getTime();
  const end = Math.min(to.getTime(), Date.now());
  for (let t = start; t <= end; t += stepMs) {
    const d = new Date(t);
    const hour = d.getUTCHours() + d.getUTCMinutes() / 60;
    const solar = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
    const powerW = Math.round(solar * 4000);
    points.push({
      ts: d,
      powerW,
      energyKwh: Number((powerW / 1000).toFixed(3)),
      status: "stub",
      metrics: { stub: true, deviceId },
    });
  }
  return points.length ? points : [stubLatest(deviceId)];
}

async function withToken<T>(
  creds: VendorCredentials,
  fn: (token: string) => Promise<T>,
): Promise<T> {
  const { accessToken } = await obtainToken(creds);
  return fn(accessToken);
}

function createAdapter(id: "solarman" | "deye"): VendorAdapter {
  return {
    id,
    credentialFields: {
      required: ["appId", "appSecret", "password", "email|username|mobile"],
      optional: [
        "accessToken",
        "baseUrl",
        "orgId",
        "stationId",
        "countryCode",
        "refreshToken",
      ],
      notes:
        id === "deye"
          ? "Deye Cloud обычно использует тот же Solarman Open API. База: globalapi.solarmanpv.com (международный) или api.solarmanpv.com (Китай)."
          : "Solarman Open API: token → list devices → currentData / historical. Пароль в API уходит как SHA-256.",
    },

    async validateCredentials(creds: VendorCredentials): Promise<boolean> {
      if (!hasLiveSolarmanCredentials(creds)) {
        // Incomplete → stub mode is OK for local wiring
        return Boolean(
          creds.appId ||
            creds.accessToken ||
            creds.email ||
            creds.username ||
            creds.password,
        );
      }
      try {
        await obtainToken(creds);
        return true;
      } catch (err) {
        console.warn(`[${id}] validateCredentials failed:`, (err as Error).message);
        return false;
      }
    },

    async listDevices(creds: VendorCredentials): Promise<DeviceInfo[]> {
      if (!hasLiveSolarmanCredentials(creds)) {
        return stubDevices();
      }

      return withToken(creds, async (token) => {
        const mapItem = (item: {
          deviceSn?: string;
          deviceId?: number;
          deviceType?: string;
          connectStatus?: number;
          collectionTime?: number;
        }): DeviceInfo | null => {
          const sn = item.deviceSn;
          if (!sn) return null;
          return {
            externalDeviceId: sn,
            name: `${item.deviceType ?? "INVERTER"} ${sn}`,
            model: item.deviceType,
            status: connectStatusToOnline(item.connectStatus),
            meta: {
              deviceId: item.deviceId,
              collectionTime: item.collectionTime,
              connectStatus: item.connectStatus,
            },
          };
        };

        if (creds.stationId) {
          const stationId = Number(creds.stationId);
          const items = await listDevicesForStation(creds, token, stationId);
          return items.map(mapItem).filter((x): x is DeviceInfo => Boolean(x));
        }

        // Prefer stations → inverters; fall back to global device list
        try {
          const stations = await listStations(creds, token);
          const out: DeviceInfo[] = [];
          for (const st of stations ?? []) {
            if (st.id == null) continue;
            const devices = await listDevicesForStation(creds, token, st.id);
            for (const d of devices) {
              const mapped = mapItem(d);
              if (mapped) {
                mapped.name = `${st.name ?? "Station"} / ${mapped.name}`;
                mapped.meta = { ...mapped.meta, stationId: st.id };
                out.push(mapped);
              }
            }
          }
          if (out.length) return out;
        } catch (err) {
          console.warn(
            `[${id}] station enumeration failed, falling back to device list:`,
            (err as Error).message,
          );
        }

        const items = await listAllDevices(creds, token);
        return items
          .map(mapItem)
          .filter((x): x is DeviceInfo => Boolean(x));
      });
    },

    async fetchLatest(
      creds: VendorCredentials,
      deviceId: string,
    ): Promise<TelemetryPoint | null> {
      if (!hasLiveSolarmanCredentials(creds)) {
        return stubLatest(deviceId);
      }

      return withToken(creds, async (token) => {
        const data = await fetchCurrentData(creds, token, deviceId);
        const parsed = parseDataList(data.dataList);
        const ts =
          data.collectionTime && data.collectionTime > 0
            ? new Date(data.collectionTime * 1000)
            : new Date();
        const online =
          data.deviceState === 1
            ? "online"
            : data.deviceState === 0
              ? "offline"
              : "unknown";
        return {
          ts,
          powerW: parsed.powerW,
          energyKwh: parsed.energyKwh,
          soc: parsed.soc,
          status: online,
          metrics: {
            ...parsed.raw,
            deviceState: data.deviceState,
            vendorDeviceId: data.deviceId,
          },
        };
      });
    },

    async fetchTelemetry(
      creds: VendorCredentials,
      deviceId: string,
      from: Date,
      to: Date,
    ): Promise<TelemetryPoint[]> {
      if (!hasLiveSolarmanCredentials(creds)) {
        return stubHistory(deviceId, from, to);
      }

      return withToken(creds, async (token) => {
        // timeType 1 = frame (intraday); for multi-day use day stats
        const spanDays =
          (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
        const timeType = spanDays > 1.5 ? 2 : 1;
        const hist = await fetchHistoricalData(
          creds,
          token,
          deviceId,
          formatDate(from),
          formatDate(to),
          timeType,
        );

        const points: TelemetryPoint[] = [];
        for (const frame of hist.paramDataList ?? []) {
          const parsed = parseDataList(frame.dataList);
          const ts =
            frame.collectionTime && frame.collectionTime > 0
              ? new Date(frame.collectionTime * 1000)
              : new Date();
          points.push({
            ts,
            powerW: parsed.powerW,
            energyKwh: parsed.energyKwh,
            soc: parsed.soc,
            status: "ok",
            metrics: parsed.raw,
          });
        }

        if (!points.length) {
          const data = await fetchCurrentData(creds, token, deviceId);
          const parsed = parseDataList(data.dataList);
          const ts =
            data.collectionTime && data.collectionTime > 0
              ? new Date(data.collectionTime * 1000)
              : new Date();
          points.push({
            ts,
            powerW: parsed.powerW,
            energyKwh: parsed.energyKwh,
            soc: parsed.soc,
            status: "ok",
            metrics: parsed.raw,
          });
        }
        return points;
      });
    },
  };
}

export const solarmanAdapter = createAdapter("solarman");
export const deyeAdapter = createAdapter("deye");
