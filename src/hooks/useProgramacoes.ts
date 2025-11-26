import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface DefensivoFazenda {
  tempId: string;
  classe: string;
  aplicacao: string;
  defensivo: string;
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
  tipo_embalagem: "BAG 5000K" | "SACAS 200K";
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
  deve_faturar?: boolean;
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
  created_at: string;
  updated_at: string;
}

export interface CreateProgramacao {
  produtor_numerocm: string;
  fazenda_idfazenda: string;
  area: string;
  area_hectares: number;
  safra_id?: string;
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

      if (Math.abs(totalCultivares - 100) > 0.1) {
        throw new Error("O percentual de cobertura das cultivares deve somar 100% (tolerância ±0,1)");
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
        const cultivaresData = newProgramacao.cultivares.map(item => {
          const tratamentoIds = item.tratamento_ids || (item.tratamento_id ? [item.tratamento_id] : []);
          const firstTratamento = item.tipo_tratamento === 'NÃO' ? null : (tratamentoIds[0] || null);
          return ({
          user_id: user.id,
          programacao_id: progResponse.data.id,
          produtor_numerocm: newProgramacao.produtor_numerocm,
          area: newProgramacao.area,
          area_hectares: newProgramacao.area_hectares,
          cultivar: item.cultivar,
          quantidade: 0,
          unidade: "kg",
          percentual_cobertura: item.percentual_cobertura,
          tipo_embalagem: item.tipo_embalagem,
          tipo_tratamento: item.tipo_tratamento,
          tratamento_id: firstTratamento, // Gravamos também o primeiro tratamento para compatibilidade
          data_plantio: item.data_plantio || null,
          populacao_recomendada: item.populacao_recomendada || 0,
          semente_propria: item.semente_propria || false,
          referencia_rnc_mapa: item.referencia_rnc_mapa || null,
          sementes_por_saca: item.sementes_por_saca || 0,
          // Grava o id da safra na linha de cultivar para facilitar o filtro
          safra: newProgramacao.safra_id || null,
          // Grava o id da época na linha de cultivar
          epoca_id: newProgramacao.epoca_id || null,
          porcentagem_salva: 0
        });
        });

        const cultResponse = await (supabase as any)
          .from("programacao_cultivares")
          .insert(cultivaresData)
          .select();

        if (cultResponse.error) throw cultResponse.error;

        // Hardening: garantir remoção de vínculos se algum item for "NÃO"
        try {
          const naoIds = (cultResponse.data || [])
            .map((row: any, idx: number) => ({ id: row.id, tipo: newProgramacao.cultivares[idx]?.tipo_tratamento }))
            .filter((p) => p.tipo === 'NÃO')
            .map((p) => p.id)
            .filter(Boolean);
          if (naoIds.length > 0) {
            await (supabase as any)
              .from('programacao_cultivares_tratamentos')
              .delete()
              .in('programacao_cultivar_id', naoIds);
          }
        } catch (_) {
          // silencioso
        }

        // Inserir tratamentos na tabela de junção N:N
        const tratamentosData = newProgramacao.cultivares.flatMap((item, idx) => {
          if (item.tipo_tratamento === 'NÃO') return [] as any[];
          const cultivarId = cultResponse.data[idx]?.id;
          const tratamentoIds = item.tratamento_ids || (item.tratamento_id ? [item.tratamento_id] : []);
          return tratamentoIds.map(tratamentoId => ({
            programacao_cultivar_id: cultivarId,
            tratamento_id: tratamentoId
          }));
        }).filter(t => t.programacao_cultivar_id && t.tratamento_id);

        if (tratamentosData.length > 0) {
          const tratResponse = await (supabase as any)
            .from("programacao_cultivares_tratamentos")
            .insert(tratamentosData);
          if (tratResponse.error) throw tratResponse.error;
        }

        // Inserir defensivos "NA FAZENDA" na tabela programacao_cultivares_defensivos
        const defensivosData = newProgramacao.cultivares.flatMap((item, idx) => {
          if (item.tipo_tratamento !== 'NA FAZENDA' || !item.defensivos_fazenda || item.defensivos_fazenda.length === 0) {
            return [] as any[];
          }
          const cultivarId = cultResponse.data[idx]?.id;
          return item.defensivos_fazenda.map(def => ({
            programacao_cultivar_id: cultivarId,
            aplicacao: def.aplicacao,
            defensivo: def.defensivo,
            dose: def.dose,
            cobertura: def.cobertura,
            total: def.total,
            produto_salvo: def.produto_salvo || false
          }));
        }).filter(d => d.programacao_cultivar_id);

        if (defensivosData.length > 0) {
          const defResponse = await (supabase as any)
            .from("programacao_cultivares_defensivos")
            .insert(defensivosData);
          if (defResponse.error) throw defResponse.error;
        }
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
          embalagem: item.embalagem || null,
          justificativa_nao_adubacao_id: item.justificativa_nao_adubacao_id || null,
          fertilizante_salvo: !!item.fertilizante_salvo,
          deve_faturar: typeof item.deve_faturar === 'boolean' ? item.deve_faturar : true,
          porcentagem_salva: Number.isFinite(item.porcentagem_salva as number)
            ? Math.min(100, Math.max(0, Number(item.porcentagem_salva)))
            : 0,
          total: null,
          // Grava o id da safra para adubação
          safra_id: newProgramacao.safra_id || null
        }));

        const adubResponse = await (supabase as any)
          .from("programacao_adubacao")
          .insert(adubacaoData);

      if (adubResponse.error) throw adubResponse.error;
      }

      // Salvar talhões selecionados na tabela programacao_talhoes
      if (newProgramacao.talhao_ids && newProgramacao.talhao_ids.length > 0) {
        const talhoesData = newProgramacao.talhao_ids.map(talhao_id => ({
          programacao_id: progResponse.data.id,
          talhao_id: talhao_id
        }));

        const talhoesResponse = await (supabase as any)
          .from("programacao_talhoes")
          .insert(talhoesData);

        if (talhoesResponse.error) throw talhoesResponse.error;
      }

      return progResponse.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programacoes-list'] });
      // Importante: atualizar listas filhas usadas na edição
      queryClient.invalidateQueries({ queryKey: ['programacao-cultivares'] });
      queryClient.invalidateQueries({ queryKey: ['programacao-adubacao'] });
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

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & CreateProgramacao) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const totalCultivares = data.cultivares.reduce(
        (sum, item) => sum + (Number(item.percentual_cobertura) || 0), 0
      );
      if (Math.abs(totalCultivares - 100) > 0.1) {
        throw new Error("O percentual de cobertura das cultivares deve somar 100% (tolerância ±0,1)");
      }

      const progUpdate = await (supabase as any)
        .from("programacoes")
        .update({
          produtor_numerocm: data.produtor_numerocm,
          fazenda_idfazenda: data.fazenda_idfazenda,
          area: data.area,
          area_hectares: data.area_hectares,
          safra_id: data.safra_id || null,
          epoca_id: data.epoca_id || null
        })
        .eq("id", id);
      if (progUpdate.error) throw progUpdate.error;

      // Substitui cultivares vinculadas (deletar também remove tratamentos via CASCADE)
      const delCult = await (supabase as any)
        .from("programacao_cultivares")
        .delete()
        .eq("programacao_id", id);
      if (delCult.error) throw delCult.error;

      if (data.cultivares.length > 0) {
        const cultivaresData = data.cultivares.map(item => {
          const tratamentoIds = item.tratamento_ids || (item.tratamento_id ? [item.tratamento_id] : []);
          const firstTratamento = item.tipo_tratamento === 'NÃO' ? null : (tratamentoIds[0] || null);
          return ({
          user_id: user.id,
          programacao_id: id,
          produtor_numerocm: data.produtor_numerocm,
          area: data.area,
          area_hectares: data.area_hectares,
          cultivar: item.cultivar,
          quantidade: 0,
          unidade: "kg",
          percentual_cobertura: item.percentual_cobertura,
          tipo_embalagem: item.tipo_embalagem,
          tipo_tratamento: item.tipo_tratamento,
          tratamento_id: firstTratamento, // Gravamos também o primeiro tratamento para compatibilidade
          data_plantio: item.data_plantio || null,
          populacao_recomendada: item.populacao_recomendada || 0,
          semente_propria: item.semente_propria || false,
          referencia_rnc_mapa: item.referencia_rnc_mapa || null,
          sementes_por_saca: item.sementes_por_saca || 0,
          // Grava o id da safra na linha de cultivar para facilitar o filtro
          safra: data.safra_id || null,
          // Grava o id da época na linha de cultivar
          epoca_id: data.epoca_id || null,
          porcentagem_salva: 0
        });
        });
        const cultInsert = await (supabase as any)
          .from("programacao_cultivares")
          .insert(cultivaresData)
          .select();
        if (cultInsert.error) throw cultInsert.error;

        // Hardening: garantir remoção de vínculos se algum item for "NÃO"
        try {
          const naoIds = (cultInsert.data || [])
            .map((row: any, idx: number) => ({ id: row.id, tipo: data.cultivares[idx]?.tipo_tratamento }))
            .filter((p) => p.tipo === 'NÃO')
            .map((p) => p.id)
            .filter(Boolean);
          if (naoIds.length > 0) {
            await (supabase as any)
              .from('programacao_cultivares_tratamentos')
              .delete()
              .in('programacao_cultivar_id', naoIds);
          }
        } catch (_) {
          // silencioso
        }

        // Inserir tratamentos na tabela de junção N:N
        const tratamentosData = data.cultivares.flatMap((item, idx) => {
          if (item.tipo_tratamento === 'NÃO') return [] as any[];
          const cultivarId = cultInsert.data[idx]?.id;
          const tratamentoIds = item.tratamento_ids || (item.tratamento_id ? [item.tratamento_id] : []);
          return tratamentoIds.map(tratamentoId => ({
            programacao_cultivar_id: cultivarId,
            tratamento_id: tratamentoId
          }));
        }).filter(t => t.programacao_cultivar_id && t.tratamento_id);

        if (tratamentosData.length > 0) {
          const tratResponse = await (supabase as any)
            .from("programacao_cultivares_tratamentos")
            .insert(tratamentosData);
          if (tratResponse.error) throw tratResponse.error;
        }

        // Inserir defensivos "NA FAZENDA" na tabela programacao_cultivares_defensivos
        const defensivosData = data.cultivares.flatMap((item, idx) => {
          if (item.tipo_tratamento !== 'NA FAZENDA' || !item.defensivos_fazenda || item.defensivos_fazenda.length === 0) {
            return [] as any[];
          }
          const cultivarId = cultInsert.data[idx]?.id;
          return item.defensivos_fazenda.map(def => ({
            programacao_cultivar_id: cultivarId,
            aplicacao: def.aplicacao,
            defensivo: def.defensivo,
            dose: def.dose,
            cobertura: def.cobertura,
            total: def.total,
            produto_salvo: def.produto_salvo || false
          }));
        }).filter(d => d.programacao_cultivar_id);

        if (defensivosData.length > 0) {
          const defResponse = await (supabase as any)
            .from("programacao_cultivares_defensivos")
            .insert(defensivosData);
          if (defResponse.error) throw defResponse.error;
        }
      }

      // Substitui talhões vinculados
      const delTalhoes = await (supabase as any)
        .from("programacao_talhoes")
        .delete()
        .eq("programacao_id", id);
      if (delTalhoes.error) throw delTalhoes.error;

      if (data.talhao_ids && data.talhao_ids.length > 0) {
        const talhoesData = data.talhao_ids.map(talhao_id => ({
          programacao_id: id,
          talhao_id: talhao_id
        }));

        const talhoesInsert = await (supabase as any)
          .from("programacao_talhoes")
          .insert(talhoesData);
        if (talhoesInsert.error) throw talhoesInsert.error;
      }

      // Substitui adubações vinculadas
      const delAdub = await (supabase as any)
        .from("programacao_adubacao")
        .delete()
        .eq("programacao_id", id);
      if (delAdub.error) throw delAdub.error;

      if (data.adubacao.length > 0) {
        const adubacaoData = data.adubacao.map(item => ({
          user_id: user.id,
          programacao_id: id,
          produtor_numerocm: data.produtor_numerocm,
          area: data.area,
          formulacao: item.formulacao,
          dose: item.dose,
          percentual_cobertura: item.percentual_cobertura,
          data_aplicacao: item.data_aplicacao || null,
          embalagem: item.embalagem || null,
          justificativa_nao_adubacao_id: item.justificativa_nao_adubacao_id || null,
          fertilizante_salvo: !!item.fertilizante_salvo,
          deve_faturar: typeof item.deve_faturar === 'boolean' ? item.deve_faturar : true,
          porcentagem_salva: Number.isFinite(item.porcentagem_salva as number)
            ? Math.min(100, Math.max(0, Number(item.porcentagem_salva)))
            : 0,
          total: null,
          // Grava o id da safra para adubação
          safra_id: data.safra_id || null
        }));
        const adubInsert = await (supabase as any)
          .from("programacao_adubacao")
          .insert(adubacaoData);
      if (adubInsert.error) throw adubInsert.error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programacoes-list'] });
      // Atualiza também as coleções derivadas para refletir imediatamente no formulário
      queryClient.invalidateQueries({ queryKey: ['programacao-cultivares'] });
      queryClient.invalidateQueries({ queryKey: ['programacao-adubacao'] });
      toast({ title: "Programação atualizada com sucesso!" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar programação",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const replicateMutation = useMutation({
    mutationFn: async ({ id, produtor_numerocm, fazenda_idfazenda, area_hectares }: { id: string; produtor_numerocm: string; fazenda_idfazenda: string; area_hectares: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      if (!area_hectares || Number(area_hectares) <= 0) {
        throw new Error("A fazenda selecionada não possui área preenchida");
      }

      // Fetch original programacao and its children
      const original = await (supabase as any)
        .from("programacoes")
        .select("*")
        .eq("id", id)
        .single();
      if (original.error) throw original.error;

      // Fetch destination fazenda name to set correct area string
      const destFazenda = await (supabase as any)
        .from("fazendas")
        .select("nomefazenda")
        .eq("idfazenda", fazenda_idfazenda)
        .eq("numerocm", produtor_numerocm)
        .maybeSingle?.() ?? await (supabase as any)
        .from("fazendas")
        .select("nomefazenda")
        .eq("idfazenda", fazenda_idfazenda)
        .eq("numerocm", produtor_numerocm)
        .single();
      if (destFazenda.error) {
        // Não bloquear replicação se nome não encontrado; usar área original como fallback
      }
      const destAreaName = destFazenda.data?.nomefazenda || original.data.area;

      const [cultOrig, adubOrig] = await Promise.all([
        (supabase as any)
          .from("programacao_cultivares")
          .select("*")
          .eq("programacao_id", id),
        (supabase as any)
          .from("programacao_adubacao")
          .select("*")
          .eq("programacao_id", id),
      ]);
      if (cultOrig.error) throw cultOrig.error;
      if (adubOrig.error) throw adubOrig.error;

      // Create new programacao using target fields and original area/safra
      const progInsert = await (supabase as any)
        .from("programacoes")
        .insert({
          user_id: user.id,
          produtor_numerocm,
          fazenda_idfazenda,
          area: destAreaName,
          area_hectares: area_hectares,
          safra_id: original.data.safra_id || null,
        })
        .select()
        .single();
      if (progInsert.error) throw progInsert.error;

      const newId = progInsert.data.id;

      // Insert replicated cultivares
      const cultivaresData = (cultOrig.data || []).map((c: any) => ({
        user_id: user.id,
        programacao_id: newId,
        produtor_numerocm,
        area: destAreaName,
        area_hectares: area_hectares,
        cultivar: c.cultivar,
        quantidade: 0,
        unidade: "kg",
        percentual_cobertura: c.percentual_cobertura,
        tipo_embalagem: c.tipo_embalagem,
        tipo_tratamento: c.tipo_tratamento,
        tratamento_id: null, // Deprecated: agora usamos tabela de junção
        data_plantio: c.data_plantio || null,
        populacao_recomendada: c.populacao_recomendada || 0,
        semente_propria: !!c.semente_propria,
        referencia_rnc_mapa: c.referencia_rnc_mapa || null,
        sementes_por_saca: c.sementes_por_saca || 0,
        // Preserva a safra original na replicação
        safra: original.data.safra_id || null,
        porcentagem_salva: 0,
      }));
      if (cultivaresData.length > 0) {
        const cultInsert = await (supabase as any)
          .from("programacao_cultivares")
          .insert(cultivaresData)
          .select();
        if (cultInsert.error) throw cultInsert.error;

        // Replicar tratamentos da tabela de junção
        const tratamentosOriginais = await Promise.all(
          (cultOrig.data || []).map(async (c: any) => {
            const { data } = await (supabase as any)
              .from("programacao_cultivares_tratamentos")
              .select("tratamento_id")
              .eq("programacao_cultivar_id", c.id);
            return { originalId: c.id, tratamentos: data || [] };
          })
        );

        const tratamentosData = cultInsert.data.flatMap((c: any, idx: number) => {
          const tratamentos = tratamentosOriginais[idx]?.tratamentos || [];
          return tratamentos.map((t: any) => ({
            programacao_cultivar_id: c.id,
            tratamento_id: t.tratamento_id
          }));
        });

        if (tratamentosData.length > 0) {
          const tratResponse = await (supabase as any)
            .from("programacao_cultivares_tratamentos")
            .insert(tratamentosData);
          if (tratResponse.error) throw tratResponse.error;
        }
      }

      // Insert replicated adubacao
      const adubacaoData = (adubOrig.data || []).map((a: any) => ({
        user_id: user.id,
        programacao_id: newId,
        produtor_numerocm,
        area: destAreaName,
        formulacao: a.formulacao,
        dose: a.dose,
        percentual_cobertura: a.percentual_cobertura,
        data_aplicacao: a.data_aplicacao || null,
        responsavel: a.responsavel || null,
        justificativa_nao_adubacao_id: a.justificativa_nao_adubacao_id || null,
        fertilizante_salvo: false,
        deve_faturar: true,
        porcentagem_salva: 0,
        total: null,
        // Preserva a safra original na replicação
        safra_id: original.data.safra_id || null,
      }));
      if (adubacaoData.length > 0) {
        const adubInsert = await (supabase as any)
          .from("programacao_adubacao")
          .insert(adubacaoData);
        if (adubInsert.error) throw adubInsert.error;
      }

      return newId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programacoes-list'] });
      queryClient.invalidateQueries({ queryKey: ['programacao-cultivares'] });
      queryClient.invalidateQueries({ queryKey: ['programacao-adubacao'] });
      toast({ title: "Replicação concluída com sucesso!" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao replicar programação",
        description: error.message,
        variant: "destructive"
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
