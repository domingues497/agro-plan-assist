import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy } from "lucide-react";
import { useSafras } from "@/hooks/useSafras";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { getApiBaseUrl } from "@/lib/utils";

export const ReplicarSafras = () => {
  const { safras } = useSafras();
  const [safraOrigemId, setSafraOrigemId] = useState<string>("");
  const [safraDestinoId, setSafraDestinoId] = useState<string>("");
  const [isReplicating, setIsReplicating] = useState(false);
  const { profile } = useProfile();

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
      const baseUrl = getApiBaseUrl();

      const token = localStorage.getItem("auth_token") || "";
      const userId = profile?.id || "";
      if (!userId) throw new Error("Usuário não autenticado");

      const getJson = async (url: string) => {
        const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt);
        }
        return res.json();
      };

      const progCult = await getJson(`${baseUrl}/programacao_cultivares`);
      const cultivares = (progCult.items || []).filter((p: any) => String(p.user_id) === userId && String(p.safra) === safraOrigemId);

      const progAdub = await getJson(`${baseUrl}/programacao_adubacao`);
      const adubacoes = (progAdub.items || []).filter((p: any) => String(p.user_id) === userId && String(p.safra_id) === safraOrigemId);

      const appl = await getJson(`${baseUrl}/aplicacoes_defensivos`);
      const aplicacoes = (appl.items || []).filter((a: any) => String(a.user_id) === userId);

      let cultivaresCopiados = 0;
      let adubacoesCopiadas = 0;
      let defensivosCopiados = 0;

      // Replicar cultivares
      if (cultivares && cultivares.length > 0) {
        for (const c of cultivares) {
          const { id, created_at, updated_at, defensivos_fazenda, tratamento_ids, ...rest } = c;
          const payload = { ...rest, safra: safraDestinoId, tratamento_ids: tratamento_ids || [], defensivos_fazenda: defensivos_fazenda || [] };
          const res = await fetch(`${baseUrl}/programacao_cultivares`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            const txt = await res.text();
            throw new Error(txt);
          }
          cultivaresCopiados += 1;
        }
      }

      // Replicar adubações
      if (adubacoes && adubacoes.length > 0) {
        for (const a of adubacoes) {
          const { id, created_at, updated_at, ...rest } = a;
          const payload = { ...rest, safra_id: safraDestinoId };
          const res = await fetch(`${baseUrl}/programacao_adubacao`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            const txt = await res.text();
            throw new Error(txt);
          }
          adubacoesCopiadas += 1;
        }
      }

      // Replicar aplicações de defensivos e seus itens
      if (aplicacoes && aplicacoes.length > 0) {
        for (const aplicacao of aplicacoes) {
          const defensivosDaAplicacao = (aplicacao.defensivos || []).filter((d: any) => String(d.safra_id) === safraOrigemId);
          if (defensivosDaAplicacao.length === 0) continue;
          const payload = {
            user_id: aplicacao.user_id,
            produtor_numerocm: aplicacao.produtor_numerocm,
            area: aplicacao.area,
            defensivos: defensivosDaAplicacao.map((d: any) => ({ ...d, safra_id: safraDestinoId })),
          };
          const res = await fetch(`${baseUrl}/aplicacoes_defensivos`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            const txt = await res.text();
            throw new Error(txt);
          }
          defensivosCopiados += defensivosDaAplicacao.length;
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
