import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/utils";

export function useImportFertilizantesMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ items }: { items: any[] }) => {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/fertilizantes/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Erro ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["fertilizantes"] });
    }
  });
}

export function useSyncFertilizantesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const baseUrl = getApiBaseUrl();
      const token = sessionStorage.getItem("auth_token");
      const res = await fetch(`${baseUrl}/fertilizantes/sync`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : "" 
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const j = await res.json().catch(() => null);
          const msg = j?.error || 'Erro ao sincronizar via API';
          const details = j?.details ? ` Detalhes: ${j.details}` : '';
          const status = j?.status ? ` (status ${j.status})` : '';
          throw new Error(`${msg}${status}${details}`);
        } else {
          const t = await res.text().catch(() => '');
          throw new Error(`Erro ao sincronizar via API (HTTP ${res.status}). ${t}`);
        }
      }
      return res.json();
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["fertilizantes"] });
    }
  });
}
