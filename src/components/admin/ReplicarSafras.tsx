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
      const token = sessionStorage.getItem("auth_token") || "";
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

      // 1. Buscar Programações (Pai)
      const programacoesRes = await getJson(`${baseUrl}/programacoes?safra_id=${safraOrigemId}`);
      const programacoes = programacoesRes.items || [];

      if (programacoes.length === 0) {
        // Se não tiver programações pai, verificamos se há itens órfãos (legado) ou defensivos
        // Mas a replicação profunda foca em programações estruturadas
      }

      // 2. Buscar dados detalhados (Cultivares, Adubação, Talhões) filtrados pela safra
      // Nota: As endpoints foram atualizadas para suportar filtragem por safra no backend
      const progCultRes = await getJson(`${baseUrl}/programacao_cultivares?safra=${safraOrigemId}`);
      const cultivares = progCultRes.items || [];

      const progAdubRes = await getJson(`${baseUrl}/programacao_adubacao?safra_id=${safraOrigemId}`);
      const adubacoes = progAdubRes.items || [];

      const progTalhoesRes = await getJson(`${baseUrl}/programacao_talhoes?safra_id=${safraOrigemId}`);
      const talhoesAssoc = progTalhoesRes.items || [];

      // 3. Agrupar dados por programacao_id
      const progMap: Record<string, any> = {};

      // Inicializa o mapa com as programações pai
      programacoes.forEach((p: any) => {
        // Filtra programações que pertencem ao usuário (ou todas se for admin/consultor com permissão)
        // O endpoint já filtra por permissão, mas podemos garantir que é do usuário se necessário
        // Como o endpoint /programacoes já filtra, usamos o que veio.
        progMap[p.id] = {
          ...p,
          cultivares: [],
          adubacao: [],
          talhao_ids: []
        };
      });

      // Distribui cultivares
      cultivares.forEach((c: any) => {
        if (c.programacao_id && progMap[c.programacao_id]) {
          progMap[c.programacao_id].cultivares.push(c);
        }
      });

      // Distribui adubações
      adubacoes.forEach((a: any) => {
        if (a.programacao_id && progMap[a.programacao_id]) {
          progMap[a.programacao_id].adubacao.push(a);
        }
      });

      // Distribui talhões
      talhoesAssoc.forEach((t: any) => {
        if (t.programacao_id && progMap[t.programacao_id]) {
          progMap[t.programacao_id].talhao_ids.push(t.talhao_id);
        }
      });

      let programacoesCopiadas = 0;
      let errosIgnorados = 0;

      // 4. Replicar Programações (Deep Copy)
      for (const progId in progMap) {
        const prog = progMap[progId];
        
        // Pular programações vazias se desejar (opcional, mas aqui replicamos tudo que existe)
        
        // Preparar payload para criar nova programação
        const payload = {
          user_id: prog.user_id,
          produtor_numerocm: prog.produtor_numerocm,
          fazenda_idfazenda: prog.fazenda_idfazenda,
          area: prog.area,
          area_hectares: prog.area_hectares,
          safra_id: safraDestinoId, // Nova safra
          epoca_id: prog.epoca_id,  // Mantém época (pode ser necessário ajustar se época for específica de safra, mas geralmente é genérica)
          
          talhao_ids: prog.talhao_ids,
          
          cultivares: prog.cultivares.map((c: any) => {
            const { id, programacao_id, created_at, updated_at, safra, ...rest } = c;
            return {
              ...rest,
              safra: safraDestinoId
            };
          }),
          
          adubacao: prog.adubacao.map((a: any) => {
            const { id, programacao_id, created_at, updated_at, safra_id, ...rest } = a;
            return {
              ...rest,
              safra_id: safraDestinoId
            };
          })
        };

        const res = await fetch(`${baseUrl}/programacoes`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const txt = await res.text();
          // Ignorar erro se talhão já tiver programação na safra destino (evita duplicidade)
          if (txt.includes("talhao já possui programação")) {
            console.warn(`Programação ignorada (duplicada): ${progId}`, txt);
            errosIgnorados++;
          } else {
            throw new Error(txt);
          }
        } else {
          programacoesCopiadas++;
        }
      }

      // 5. Replicar Aplicações de Defensivos (Independentes)
      const applRes = await getJson(`${baseUrl}/aplicacoes_defensivos`);
      const aplicacoes = (applRes.items || []).filter((a: any) => String(a.user_id) === userId);
      
      let defensivosCopiados = 0;
      
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
             // Defensivos podem não ter validação estrita de duplicidade, mas se tiver, tratamos aqui
            throw new Error(txt);
          }
          defensivosCopiados += defensivosDaAplicacao.length;
        }
      }

      const safraOrigem = safras.find(s => s.id === safraOrigemId)?.nome;
      const safraDestino = safras.find(s => s.id === safraDestinoId)?.nome;

      toast.success(
        `Replicação concluída! ${programacoesCopiadas} programações completas e ${defensivosCopiados} defensivos avulsos copiados de ${safraOrigem} para ${safraDestino}.` + 
        (errosIgnorados > 0 ? ` (${errosIgnorados} itens ignorados por duplicidade)` : "")
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
