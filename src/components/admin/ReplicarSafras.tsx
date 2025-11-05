import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy } from "lucide-react";
import { useSafras } from "@/hooks/useSafras";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const ReplicarSafras = () => {
  const { safras } = useSafras();
  const [safraOrigemId, setSafraOrigemId] = useState<string>("");
  const [safraDestinoId, setSafraDestinoId] = useState<string>("");
  const [isReplicating, setIsReplicating] = useState(false);

  const handleReplicate = async () => {
    if (!safraOrigemId || !safraDestinoId) {
      toast.error("Selecione as safras de origem e destino");
      return;
    }

    if (safraOrigemId === safraDestinoId) {
      toast.error("As safras de origem e destino devem ser diferentes");
      return;
    }

    setIsReplicating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Buscar programações de cultivares da safra origem
      const { data: cultivares, error: errorCultivares } = await supabase
        .from("programacao_cultivares")
        .select("*")
        .eq("user_id", user.id)
        .eq("safra", safraOrigemId);

      if (errorCultivares) throw errorCultivares;

      // Buscar programações de adubação da safra origem
      const { data: adubacoes, error: errorAdubacoes } = await supabase
        .from("programacao_adubacao")
        .select("*")
        .eq("user_id", user.id)
        .eq("safra_id", safraOrigemId);

      if (errorAdubacoes) throw errorAdubacoes;

      // Buscar aplicações de defensivos da safra origem
      const { data: aplicacoes, error: errorAplicacoes } = await supabase
        .from("aplicacoes_defensivos")
        .select("*")
        .eq("user_id", user.id);

      if (errorAplicacoes) throw errorAplicacoes;

      // Buscar defensivos associados às aplicações
      const aplicacoesIds = aplicacoes?.map(a => a.id) || [];
      const { data: defensivos, error: errorDefensivos } = await supabase
        .from("programacao_defensivos")
        .select("*")
        .eq("user_id", user.id)
        .eq("safra_id", safraOrigemId)
        .in("aplicacao_id", aplicacoesIds);

      if (errorDefensivos) throw errorDefensivos;

      let cultivaresCopiados = 0;
      let adubacoesCopiadas = 0;
      let defensivosCopiados = 0;

      // Replicar cultivares
      if (cultivares && cultivares.length > 0) {
        const cultivaresNovos = cultivares.map(({ id, created_at, updated_at, ...rest }) => ({
          ...rest,
          safra: safraDestinoId,
        }));

        const { error: errorInsertCultivares } = await supabase
          .from("programacao_cultivares")
          .insert(cultivaresNovos);

        if (errorInsertCultivares) throw errorInsertCultivares;
        cultivaresCopiados = cultivaresNovos.length;
      }

      // Replicar adubações
      if (adubacoes && adubacoes.length > 0) {
        const adubacoesNovas = adubacoes.map(({ id, created_at, updated_at, ...rest }) => ({
          ...rest,
          safra_id: safraDestinoId,
        }));

        const { error: errorInsertAdubacoes } = await supabase
          .from("programacao_adubacao")
          .insert(adubacoesNovas);

        if (errorInsertAdubacoes) throw errorInsertAdubacoes;
        adubacoesCopiadas = adubacoesNovas.length;
      }

      // Replicar aplicações de defensivos e seus itens
      if (aplicacoes && aplicacoes.length > 0) {
        for (const aplicacao of aplicacoes) {
          // Criar nova aplicação
          const { id: oldId, created_at, updated_at, ...aplicacaoRest } = aplicacao;
          const { data: novaAplicacao, error: errorNovaAplicacao } = await supabase
            .from("aplicacoes_defensivos")
            .insert(aplicacaoRest)
            .select()
            .single();

          if (errorNovaAplicacao) throw errorNovaAplicacao;

          // Buscar defensivos desta aplicação específica
          const defensivosDaAplicacao = defensivos?.filter(d => d.aplicacao_id === oldId) || [];

          if (defensivosDaAplicacao.length > 0) {
            const defensivosNovos = defensivosDaAplicacao.map(({ id, created_at, updated_at, ...rest }) => ({
              ...rest,
              aplicacao_id: novaAplicacao.id,
              safra_id: safraDestinoId,
            }));

            const { error: errorInsertDefensivos } = await supabase
              .from("programacao_defensivos")
              .insert(defensivosNovos);

            if (errorInsertDefensivos) throw errorInsertDefensivos;
            defensivosCopiados += defensivosNovos.length;
          }
        }
      }

      const safraOrigem = safras.find(s => s.id === safraOrigemId)?.nome;
      const safraDestino = safras.find(s => s.id === safraDestinoId)?.nome;

      toast.success(
        `Replicação concluída! ${cultivaresCopiados} cultivares, ${adubacoesCopiadas} adubações e ${defensivosCopiados} defensivos copiados de ${safraOrigem} para ${safraDestino}`
      );

      setSafraOrigemId("");
      setSafraDestinoId("");
    } catch (error: any) {
      console.error("Erro ao replicar safras:", error);
      toast.error(`Erro ao replicar: ${error.message}`);
    } finally {
      setIsReplicating(false);
    }
  };

  const safrasAtivas = safras.filter(s => s.ativa);

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2">Replicar Programações entre Safras</h3>
          <p className="text-sm text-muted-foreground">
            Copie todas as programações (cultivares, adubações e defensivos) de uma safra para outra.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="safra-origem">Safra de Origem *</Label>
            <Select value={safraOrigemId} onValueChange={setSafraOrigemId}>
              <SelectTrigger id="safra-origem">
                <SelectValue placeholder="Selecione a safra origem" />
              </SelectTrigger>
              <SelectContent>
                {safrasAtivas.map((safra) => (
                  <SelectItem key={safra.id} value={safra.id}>
                    {safra.nome}
                    {safra.is_default && " (Padrão)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="safra-destino">Safra de Destino *</Label>
            <Select value={safraDestinoId} onValueChange={setSafraDestinoId}>
              <SelectTrigger id="safra-destino">
                <SelectValue placeholder="Selecione a safra destino" />
              </SelectTrigger>
              <SelectContent>
                {safrasAtivas.map((safra) => (
                  <SelectItem key={safra.id} value={safra.id}>
                    {safra.nome}
                    {safra.is_default && " (Padrão)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={handleReplicate}
          disabled={!safraOrigemId || !safraDestinoId || isReplicating}
          className="w-full"
        >
          <Copy className="mr-2 h-4 w-4" />
          {isReplicating ? "Replicando..." : "Replicar Programações"}
        </Button>
      </div>
    </Card>
  );
};
