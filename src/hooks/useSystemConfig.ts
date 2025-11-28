import { useQuery } from "@tanstack/react-query";

export type SystemConfigItem = {
  config_key: string;
  config_value: string | null;
  description?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export const useSystemConfig = () => {
  return useQuery({
    queryKey: ["system-config"],
    queryFn: async () => {
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const baseUrl = envUrl || `http://${host}:5000`;
      const res = await fetch(`${baseUrl}/config`);
      if (!res.ok) throw new Error(`Erro ao carregar configurações: ${res.status}`);
      const json = await res.json();
      return (json?.items ?? []) as SystemConfigItem[];
    },
  });
};

export const upsertSystemConfig = async (items: SystemConfigItem[]) => {
  const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  const baseUrl = envUrl || `http://${host}:5000`;
  const res = await fetch(`${baseUrl}/config/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.error || `Erro ao salvar configurações: ${res.status}`);
  }
  return res.json();
};
