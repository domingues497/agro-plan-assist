import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ItemCultivar {
  cultivar: string;
  quantidade: number;
  unidade: string;
  percentual_cobertura: number;
  data_plantio?: string;
  populacao_recomendada?: number;
  semente_propria?: boolean;
  referencia_rnc_mapa?: string;
  sementes_por_saca?: number;
}

export interface ItemAdubacao {
  formulacao: string;
  dose: number;
  percentual_cobertura: number;
  data_aplicacao?: string;
  responsavel?: string;
}

export interface Programacao {
  id: string;
  user_id: string;
  produtor_numerocm: string;
  fazenda_idfazenda: string;
  area: string;
  area_hectares: number;
  safra_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProgramacao {
  produtor_numerocm: string;
  fazenda_idfazenda: string;
  area: string;
  area_hectares: number;
  safra_id?: string;
  cultivares: ItemCultivar[];
  adubacao: ItemAdubacao[];
}

export const useProgramacoes = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: programacoes, isLoading } = useQuery({
    queryKey: ['programacoes-list'],
    queryFn: async (): Promise<Programacao[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const response = await (supabase as any)
        .from("programacoes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (response.error) throw response.error;
      return (response.data || []);
    }
  });

  const createMutation = useMutation({
    mutationFn: async (newProgramacao: CreateProgramacao) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const totalCultivares = newProgramacao.cultivares.reduce(
        (sum, item) => sum + item.percentual_cobertura, 0
      );

      if (Math.abs(totalCultivares - 100) > 0.01) {
        throw new Error("O percentual de cobertura das cultivares deve somar exatamente 100%");
      }

      const progResponse = await (supabase as any)
        .from("programacoes")
        .insert({
          user_id: user.id,
          produtor_numerocm: newProgramacao.produtor_numerocm,
          fazenda_idfazenda: newProgramacao.fazenda_idfazenda,
          area: newProgramacao.area,
          area_hectares: newProgramacao.area_hectares,
          safra_id: newProgramacao.safra_id || null
        })
        .select()
        .single();

      if (progResponse.error) throw progResponse.error;

      if (newProgramacao.cultivares.length > 0) {
        const cultivaresData = newProgramacao.cultivares.map(item => ({
          user_id: user.id,
          programacao_id: progResponse.data.id,
          produtor_numerocm: newProgramacao.produtor_numerocm,
          area: newProgramacao.area,
          area_hectares: newProgramacao.area_hectares,
          cultivar: item.cultivar,
          quantidade: item.quantidade,
          unidade: item.unidade,
          percentual_cobertura: item.percentual_cobertura,
          data_plantio: item.data_plantio || null,
          populacao_recomendada: item.populacao_recomendada || 0,
          semente_propria: item.semente_propria || false,
          referencia_rnc_mapa: item.referencia_rnc_mapa || null,
          sementes_por_saca: item.sementes_por_saca || 0,
          safra: null,
          porcentagem_salva: 0
        }));

        const cultResponse = await (supabase as any)
          .from("programacao_cultivares")
          .insert(cultivaresData);

        if (cultResponse.error) throw cultResponse.error;
      }

      if (newProgramacao.adubacao.length > 0) {
        const adubacaoData = newProgramacao.adubacao.map(item => ({
          user_id: user.id,
          programacao_id: progResponse.data.id,
          produtor_numerocm: newProgramacao.produtor_numerocm,
          area: newProgramacao.area,
          formulacao: item.formulacao,
          dose: item.dose,
          percentual_cobertura: item.percentual_cobertura,
          data_aplicacao: item.data_aplicacao || null,
          responsavel: item.responsavel || null,
          fertilizante_salvo: false,
          deve_faturar: true,
          porcentagem_salva: 0,
          total: null,
          safra_id: null
        }));

        const adubResponse = await (supabase as any)
          .from("programacao_adubacao")
          .insert(adubacaoData);

        if (adubResponse.error) throw adubResponse.error;
      }

      return progResponse.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programacoes-list'] });
      toast({ title: "Programação criada com sucesso!" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar programação",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await (supabase as any)
        .from("programacoes")
        .delete()
        .eq("id", id);

      if (response.error) throw response.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programacoes-list'] });
      toast({ title: "Programação excluída com sucesso!" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir programação",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  return {
    programacoes: programacoes || [],
    isLoading,
    create: createMutation.mutate,
    delete: deleteMutation.mutate
  };
};
