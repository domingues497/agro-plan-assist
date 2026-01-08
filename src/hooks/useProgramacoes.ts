import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export interface DefensivoFazenda {
  tempId: string;
  classe: string;
  aplicacao: string;
  defensivo: string;
  cod_item?: string;
  dose: number;
  cobertura: number;
  total: number;
  produto_salvo: boolean;
  porcentagem_salva: number;
}

export interface ItemCultivar {
  cultivar: string;
  cultura?: string;
  percentual_cobertura: number;
  tipo_embalagem: string;
  tipo_tratamento: "NÃO" | "NA FAZENDA" | "INDUSTRIAL";
  tratamento_id?: string;
  // Suporte a múltiplos tratamentos selecionados na UI; persistimos o primeiro
  tratamento_ids?: string[];
  data_plantio?: string;
  populacao_recomendada?: number;
  semente_propria?: boolean;
  referencia_rnc_mapa?: string;
  sementes_por_saca?: number;
  defensivos_fazenda?: DefensivoFazenda[];
}

export interface ItemAdubacao {
  formulacao: string;
  dose: number;
  percentual_cobertura: number;
  data_aplicacao?: string;
  embalagem?: string;
  justificativa_nao_adubacao_id?: string;
  // Flags RN012/RN013 na programação
  fertilizante_salvo?: boolean;
  porcentagem_salva?: number;
}

export interface Programacao {
  id: string;
  user_id: string;
  produtor_numerocm: string;
  fazenda_idfazenda: string;
  area: string;
  area_hectares: number;
  safra_id: string | null;
  epoca_id?: string;
  fazenda_uuid?: string;
  tipo?: "PREVIA" | "PROGRAMACAO";
  revisada?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProgramacao {
  produtor_numerocm: string;
  fazenda_idfazenda: string;
  fazenda_uuid?: string;
  area: string;
  area_hectares: number;
  safra_id?: string;
  tipo?: "PREVIA" | "PROGRAMACAO";
  epoca_id?: string;
  talhao_ids?: string[];
  cultivares: ItemCultivar[];
  adubacao: ItemAdubacao[];
}

export const useProgramacoes = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: programacoes, isLoading } = useQuery({
    queryKey: ['programacoes-list'],
    queryFn: async (): Promise<Programacao[]> => {
      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();
      const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("auth_token") : null;
      const res = await fetch(`${baseUrl}/programacoes`, {
        credentials: "omit",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error(`Erro ao carregar programações: ${res.status}`);
      const json = await res.json();
      return (json?.items ?? []) as Programacao[];
    }
  });

  const createMutation = useMutation({
    mutationFn: async (newProgramacao: CreateProgramacao) => {
      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();

      const totalCultivares = newProgramacao.cultivares.reduce(
        (sum, item) => sum + item.percentual_cobertura, 0
      );

      if (Math.abs(totalCultivares - 100) > 0.1) {
        throw new Error("O percentual de cobertura das cultivares deve somar 100% (tolerância ±0,1)");
      }

      const payload = {
        user_id: undefined,
        ...newProgramacao,
      } as any;
      try {
        const defs = Array.isArray(payload.cultivares)
          ? payload.cultivares.map((c: any) => c?.defensivos_fazenda || [])
          : [];
        console.log("[programacoes:create] defensivos_fazenda payload:", defs);
      } catch {}
      const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("auth_token") : null;
      const res = await fetch(`${baseUrl}/programacoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const progResponse = await res.json();
      return progResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programacoes-list'] });
      queryClient.invalidateQueries({ queryKey: ['programacao-areas-calc'] });
      // Importante: atualizar listas filhas usadas na edição
      queryClient.invalidateQueries({ queryKey: ['programacao-cultivares'] });
      queryClient.invalidateQueries({ queryKey: ['programacao-adubacao'] });
      toast({ title: "Programação criada com sucesso!" });
    },
    onError: (error: any) => {
      const raw = error?.message || String(error);
      try {
        const data = JSON.parse(raw);
        if (data?.error === "talhao já possui programação nesta safra") {
          const nomes = Array.isArray(data?.talhoes_nomes) && data.talhoes_nomes.length > 0
            ? data.talhoes_nomes.join(", ")
            : undefined;
          const ids = Array.isArray(data?.talhoes) ? data.talhoes.join(", ") : "";
          toast({
            title: "Conflito de Programação",
            description: nomes
              ? `Os talhões ${nomes} já possuem programação na safra selecionada.`
              : (ids
                  ? `Os talhões ${ids} já possuem programação na safra selecionada.`
                  : "Já existe uma programação para ao menos um dos talhões na safra selecionada."),
            variant: "destructive",
          });
          return;
        }
      } catch {}
      toast({
        title: "Erro ao criar programação",
        description: raw,
        variant: "destructive",
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();
      const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("auth_token") : null;
      const res = await fetch(`${baseUrl}/programacoes/${id}`, { method: "DELETE", headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programacoes-list'] });
      queryClient.invalidateQueries({ queryKey: ['programacao-areas-calc'] });
      toast({ title: "Programação excluída com sucesso!" });
    },
    onError: (error: any) => {
      const raw = error?.message || String(error);
      try {
        const data = JSON.parse(raw);
        if (data?.error === "programacao_defensivos_existente") {
          const nomes = Array.isArray(data?.talhoes_nomes) && data.talhoes_nomes.length > 0
            ? data.talhoes_nomes.join(", ")
            : undefined;
          const count = Number(data?.count || 0);
          toast({
            title: "Exclusão bloqueada",
            description: nomes
              ? `Existem ${count} registros de defensivos para esta fazenda/safra.
Talhões: ${nomes}.`
              : `Existem ${count} registros de defensivos para esta fazenda/safra.`,
            variant: "destructive",
          });
          return;
        }
      } catch {}
      toast({
        title: "Erro ao excluir programação",
        description: raw,
        variant: "destructive",
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<CreateProgramacao> & { revisada?: boolean }) => {
      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();
      const totalCultivares = data.cultivares ? data.cultivares.reduce((sum, item) => sum + (Number(item.percentual_cobertura) || 0), 0) : 0;
      if (data.cultivares && Math.abs(totalCultivares - 100) > 0.1) {
        throw new Error("O percentual de cobertura das cultivares deve somar 100% (tolerância ±0,1)");
      }
      const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("auth_token") : null;
      try {
        const defs = Array.isArray(data.cultivares)
          ? data.cultivares.map((c: any) => c?.defensivos_fazenda || [])
          : [];
        console.log("[programacoes:update] defensivos_fazenda payload:", defs);
      } catch {}
      const res = await fetch(`${baseUrl}/programacoes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(data as any)
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programacoes-list'] });
      queryClient.invalidateQueries({ queryKey: ['programacao-areas-calc'] });
      // Atualiza também as coleções derivadas para refletir imediatamente no formulário
      queryClient.invalidateQueries({ queryKey: ['programacao-cultivares'] });
      queryClient.invalidateQueries({ queryKey: ['programacao-adubacao'] });
      toast({ title: "Programação atualizada com sucesso!" });
    },
    onError: (error: any) => {
      const raw = error?.message || String(error);
      try {
        const data = JSON.parse(raw);
        if (data?.error === "talhao já possui programação nesta safra") {
          const nomes = Array.isArray(data?.talhoes_nomes) && data.talhoes_nomes.length > 0
            ? data.talhoes_nomes.join(", ")
            : undefined;
          const ids = Array.isArray(data?.talhoes) ? data.talhoes.join(", ") : "";
          toast({
            title: "Conflito de Programação",
            description: nomes
              ? `Os talhões ${nomes} já possuem programação na safra selecionada.`
              : (ids
                  ? `Os talhões ${ids} já possuem programação na safra selecionada.`
                  : "Já existe uma programação para ao menos um dos talhões na safra selecionada."),
            variant: "destructive",
          });
          return;
        }
      } catch {}
      toast({
        title: "Erro ao atualizar programação",
        description: raw,
        variant: "destructive",
      });
    }
  });

  const replicateMutation = useMutation({
    mutationFn: async ({ id, produtor_numerocm, fazenda_idfazenda, area_hectares, area_name }: { id: string; produtor_numerocm: string; fazenda_idfazenda: string; area_hectares: number; area_name?: string }) => {
      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();
      if (!area_hectares || Number(area_hectares) <= 0) {
        throw new Error("A fazenda selecionada não possui área preenchida");
      }
      const original = (programacoes || []).find(p => p.id === id);
      if (!original) throw new Error("Programação não encontrada");
      const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("auth_token") : null;
      const childrenRes = await fetch(`${baseUrl}/programacoes/${id}/children`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!childrenRes.ok) throw new Error(`Erro ao carregar filhos: ${childrenRes.status}`);
      const children = await childrenRes.json();
      const tratamentos: Record<string, string[]> = children?.tratamentos || {};
      const defensivos: any[] = children?.defensivos || [];
      const cultivaresSrc: any[] = children?.cultivares || [];
      const adubacaoSrc: any[] = children?.adubacao || [];
      const defensivosMap: Record<string, any[]> = {};
      defensivos.forEach(d => {
        const key = d.programacao_cultivar_id;
        if (!key) return;
        if (!defensivosMap[key]) defensivosMap[key] = [];
        defensivosMap[key].push({
          classe: d.classe,
          aplicacao: d.aplicacao,
          defensivo: d.defensivo,
          dose: d.dose,
          cobertura: d.cobertura,
          total: d.total,
          produto_salvo: !!d.produto_salvo
        });
      });
      const destAreaName = area_name || original.area;
      const payload: CreateProgramacao = {
        produtor_numerocm,
        fazenda_idfazenda,
        area: destAreaName,
        area_hectares,
        safra_id: original.safra_id || undefined,
        tipo: original.tipo || "PROGRAMACAO",
        epoca_id: undefined,
        talhao_ids: [],
        cultivares: cultivaresSrc.map(c => ({
          cultivar: c.cultivar,
          percentual_cobertura: Number(c.percentual_cobertura) || 0,
          tipo_embalagem: c.tipo_embalagem,
          tipo_tratamento: c.tipo_tratamento,
          tratamento_ids: tratamentos[c.id] || [],
          data_plantio: c.data_plantio || null,
          populacao_recomendada: Number(c.populacao_recomendada) || 0,
          semente_propria: !!c.semente_propria,
          referencia_rnc_mapa: c.referencia_rnc_mapa || null,
          sementes_por_saca: Number(c.sementes_por_saca) || 0,
          defensivos_fazenda: c.tipo_tratamento === 'NA FAZENDA' ? (defensivosMap[c.id] || []) : []
        })),
        adubacao: adubacaoSrc.map(a => ({
          formulacao: a.formulacao,
          dose: Number(a.dose) || 0,
          percentual_cobertura: Number(a.percentual_cobertura) || 0,
          data_aplicacao: a.data_aplicacao || null,
          embalagem: a.embalagem || null,
          justificativa_nao_adubacao_id: a.justificativa_nao_adubacao_id || null,
          fertilizante_salvo: !!a.fertilizante_salvo,
          deve_faturar: typeof a.deve_faturar === 'boolean' ? a.deve_faturar : true,
          porcentagem_salva: Number(a.porcentagem_salva) || 0
        }))
      };
      const res = await fetch(`${baseUrl}/programacoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload as any)
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const json = await res.json();
      return json?.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programacoes-list'] });
      queryClient.invalidateQueries({ queryKey: ['programacao-areas-calc'] });
      queryClient.invalidateQueries({ queryKey: ['programacao-cultivares'] });
      queryClient.invalidateQueries({ queryKey: ['programacao-adubacao'] });
      toast({ title: "Replicação concluída com sucesso!" });
    },
    onError: (error: any) => {
      const raw = error?.message || String(error);
      try {
        const data = JSON.parse(raw);
        if (data?.error === "talhao já possui programação nesta safra") {
          const nomes = Array.isArray(data?.talhoes_nomes) && data.talhoes_nomes.length > 0
            ? data.talhoes_nomes.join(", ")
            : undefined;
          const ids = Array.isArray(data?.talhoes) ? data.talhoes.join(", ") : "";
          toast({
            title: "Conflito de Programação",
            description: nomes
              ? `Os talhões ${nomes} já possuem programação na safra selecionada.`
              : (ids
                  ? `Os talhões ${ids} já possuem programação na safra selecionada.`
                  : "Já existe uma programação para ao menos um dos talhões na safra selecionada."),
            variant: "destructive",
          });
          return;
        }
      } catch {}
      toast({
        title: "Erro ao replicar programação",
        description: raw,
        variant: "destructive",
      });
    }
  });

  return {
    programacoes: programacoes || [],
    isLoading,
    create: createMutation.mutate,
    delete: deleteMutation.mutate,
    update: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    replicate: replicateMutation.mutateAsync,
    isReplicating: replicateMutation.isPending
  };
};
