import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/utils";

export function useBulkLinkCultivaresTratamentosMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tratamentoId, cultivares }: { tratamentoId: string, cultivares: string[] }) => {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/cultivares_tratamentos/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tratamento_id: tratamentoId, cultivares }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Erro ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tratamentos-por-cultivar"] });
    }
  });
}

export function useSetTratamentosForCultivarMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ cultivar, tratamentoIds }: { cultivar: string, tratamentoIds: string[] }) => {
      const baseUrl = getApiBaseUrl();
      const token = sessionStorage.getItem("auth_token");
      const res = await fetch(`${baseUrl}/cultivares_tratamentos/set_for_cultivar`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({ cultivar, tratamento_ids: tratamentoIds }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Erro ${res.status}`);
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tratamentos-por-cultivar", variables.cultivar] });
    }
  });
}
