import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProdutores } from "@/hooks/useProdutores";
import { useFazendas } from "@/hooks/useFazendas";
import { getApiBaseUrl } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { TalhaoThumbnail } from "@/components/TalhaoThumbnail";

export const RelatorioMapaFazendas = () => {
  const [produtorNumerocm, setProdutorNumerocm] = useState("");
  const [fazendaId, setFazendaId] = useState("");

  const { data: produtores } = useProdutores();
  const { data: allFazendas } = useFazendas();

  const filteredFazendas = allFazendas?.filter(f => f.numerocm === produtorNumerocm) || [];

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["report-mapa-fazendas", produtorNumerocm, fazendaId],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl();
      const params = new URLSearchParams();
      if (produtorNumerocm && produtorNumerocm !== "all") params.append("produtor_numerocm", produtorNumerocm);
      if (fazendaId) params.append("fazenda_id", fazendaId);

      const res = await fetch(`${baseUrl}/reports/mapa_fazendas?${params}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: false,
  });

  const handleGenerate = () => {
    refetch();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium">Produtor</label>
              <Select value={produtorNumerocm} onValueChange={(val) => { setProdutorNumerocm(val); setFazendaId(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {produtores?.map((p: any) => (
                    <SelectItem key={p.id} value={p.numerocm}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Fazenda</label>
              <Select value={fazendaId || "all"} onValueChange={(val) => setFazendaId(val === "all" ? "" : val)} disabled={!produtorNumerocm || produtorNumerocm === "all"}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {filteredFazendas.map((f: any) => (
                    <SelectItem key={f.id} value={f.idfazenda}>{f.nomefazenda}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleGenerate} disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Gerar Relatório
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {data && data.map((farm: any, idx: number) => (
        <Card key={idx} className="break-inside-avoid">
          <CardHeader>
            <CardTitle>{farm.fazenda} - {farm.produtor}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {farm.talhoes.map((t: any) => (
                <div key={t.id} className="flex flex-col items-center p-2 border rounded-md bg-muted/20">
                    <div className="w-24 h-24 mb-2 flex items-center justify-center bg-white rounded border overflow-hidden">
                        <TalhaoThumbnail geojson={t.geojson} className="w-full h-full" />
                    </div>
                    <span className="font-semibold text-center text-sm truncate w-full" title={t.nome}>{t.nome}</span>
                    <span className="text-xs text-muted-foreground">{t.area} ha</span>
                </div>
              ))}
              {farm.talhoes.length === 0 && (
                  <div className="col-span-full text-center text-muted-foreground py-4">
                      Nenhum talhão encontrado
                  </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
