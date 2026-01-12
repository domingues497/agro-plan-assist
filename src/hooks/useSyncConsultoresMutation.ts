import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/utils";

export function useSyncConsultoresMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/consultores/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          const j = await res.json().catch(() => null);
          const msg = j?.error || "Erro ao sincronizar via API";
          const details = j?.details ? ` Detalhes: ${j.details}` : "";
          const status = j?.status ? ` (status ${j.status})` : "";
          throw new Error(`${msg}${status}${details}`);
        } else {
          const t = await res.text().catch(() => "");
          throw new Error(`Erro ao sincronizar via API (HTTP ${res.status}). ${t}`);
        }
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consultores"] });
    }
  });
}
