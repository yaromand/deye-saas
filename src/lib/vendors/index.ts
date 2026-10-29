import { deyeAdapter, solarmanAdapter } from "./solarman";
import type { VendorAdapter, VendorId } from "./types";

const registry = new Map<VendorId, VendorAdapter>([
  ["solarman", solarmanAdapter],
  ["deye", deyeAdapter],
]);

export function getVendorAdapter(id: VendorId): VendorAdapter | undefined {
  return registry.get(id);
}

export function listVendorAdapters(): VendorAdapter[] {
  return Array.from(registry.values());
}

export function registerVendorAdapter(adapter: VendorAdapter): void {
  registry.set(adapter.id, adapter);
}

export type {
  DeviceInfo,
  TelemetryPoint,
  VendorAdapter,
  VendorCredentials,
  VendorId,
} from "./types";
