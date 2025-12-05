import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Gera um UUID compatível em ambientes onde crypto.randomUUID não existe
export function safeRandomUUID(): string {
  const c: any = (globalThis as any).crypto;
  if (c?.randomUUID) {
    try {
      return c.randomUUID();
    } catch {}
  }
  if (c?.getRandomValues) {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
    return `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-${hex[6]}${hex[7]}-${hex[8]}${hex[9]}-${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`;
  }
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

export function getApiBaseUrl(): string {
  const envUrl = (import.meta as any).env?.VITE_API_URL as string | undefined;
  const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
  const isBrowser = typeof window !== "undefined";
  const isHttps = isBrowser && window.location.protocol === "https:";
  const isLocalHost = ["localhost", "127.0.0.1"].includes(host);

  if (isBrowser) {
    const origin = `${window.location.protocol}//${window.location.host}`;
    const port = String(window.location.port || "");
    const isDefaultHttpPort = !port || port === "80";
    if (isLocalHost) {
      const normalizedEnv = (envUrl || "").trim();
      if (normalizedEnv) {
        return normalizedEnv;
      }
      return origin.replace(/\/$/, "") + "/api";
    }
    if (isDefaultHttpPort) {
      return origin.replace(/\/$/, "") + "/api";
    }
    if (/coopagricola\.coop\.br$/i.test(host)) {
      return origin.replace(/\/$/, "") + "/api";
    }
    return origin.replace(/\/$/, "") + "/api";
  }

  if (envUrl && envUrl.trim()) {
    return envUrl.trim();
  }
  if (isHttps) {
    return `https://${host}`;
  }
  return `http://${host}:5000`;
}
