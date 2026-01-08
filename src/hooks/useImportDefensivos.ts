import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/utils";

export function useImportDefensivosMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ items }: { items: any[] }) => {
      const baseUrl = getApiBaseUrl();
      const token = sessionStorage.getItem("auth_token");
      const res = await fetch(`${baseUrl}/defensivos/bulk`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : "" 
        },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || 'Falha ao importar via API');
      }
      return res.json();
    },
    onSuccess: () => {
        // Invalidate queries if there are any that list defensivos
        queryClient.invalidateQueries({ queryKey: ["defensivos"] });
    }
  });
}

export function useSyncDefensivosMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const baseUrl = getApiBaseUrl();
      const token = sessionStorage.getItem("auth_token");
      
      // Check connectivity first (optional, but good practice if we want to fail fast)
      // Or we can just let the sync call fail if backend is offline.
      // The original code checked health then sync/test then sync.
      
      // We will preserve the logic in the component or move it here?
      // Moving it here makes the hook cleaner but maybe less granular control over UI status (like 'checking', 'online').
      // Let's keep the detailed check in the component or a separate helper, 
      // but the actual sync call should be this mutation.
      
      const res = await fetch(`${baseUrl}/defensivos/sync`, {
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
          const msg = j?.error || 'Erro ao sincronizar via API externa';
          const details = j?.details ? ` Detalhes: ${j.details}` : '';
          const status = j?.status ? ` (status ${j.status})` : '';
          throw new Error(`${msg}${status}${details}`);
        } else {
          const t = await res.text().catch(() => '');
          throw new Error(`Erro ao sincronizar via API externa (HTTP ${res.status}). ${t}`);
        }
      }
      return res.json();
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["defensivos"] });
    }
  });
}
