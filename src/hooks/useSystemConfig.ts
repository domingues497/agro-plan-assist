import { useQuery } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/utils";

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
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/config`);
      if (!res.ok) throw new Error(`Erro ao carregar configurações: ${res.status}`);
      const json = await res.json();
      return (json?.items ?? []) as SystemConfigItem[];
    },
  });
};

export const upsertSystemConfig = async (items: SystemConfigItem[]) => {
  const baseUrl = getApiBaseUrl();
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
