import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProdutores } from "@/hooks/useProdutores";
import { useFazendas } from "@/hooks/useFazendas";
import { getApiBaseUrl } from "@/lib/utils";
import { Loader2, Printer } from "lucide-react";
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

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print:space-y-2">
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Filtros do Relatório</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
            <div className="flex items-end gap-2 lg:col-span-3">
              <Button onClick={handleGenerate} disabled={isLoading} className="w-full md:w-auto">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Gerar Relatório
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {data && data.length > 0 && (
        <div className="space-y-8 print:p-0">
          <div className="flex justify-between items-center print:hidden">
            <h2 className="text-2xl font-bold">Resultados</h2>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
          </div>

          <div className="hidden print:block mb-8 text-center">
            <h1 className="text-3xl font-bold mb-2">Mapa de Fazendas</h1>
          </div>

          {data.map((farm: any, idx: number) => (
            <Card key={idx} className="break-inside-avoid">
              <CardHeader>
                <CardTitle>{farm.fazenda} - {farm.produtor}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {farm.talhoes.map((t: any) => (
                    <div key={t.id} className="flex flex-row items-start p-4 border rounded-md bg-muted/20 break-inside-avoid" title={t.localizacao?.endereco_formatado || "Sem localização"}>
                        <div className="w-40 h-40 flex-shrink-0 flex items-center justify-center bg-white rounded border overflow-hidden mr-4">
                            <TalhaoThumbnail geojson={t.geojson} className="w-full h-full" />
                        </div>
                        <div className="flex flex-col justify-center h-full pt-2">
                            <span className="font-bold text-lg mb-1">{t.nome}</span>
                            <span className="text-sm text-muted-foreground mb-1">Área: <span className="font-medium text-foreground">{t.area} ha</span></span>
                            {t.localizacao?.cidade ? (
                                <div className="flex flex-col gap-1 mt-1">
                                    <span className="text-xs text-muted-foreground">Localização:</span>
                                    <span className="text-sm font-medium">
                                        {t.localizacao.cidade} - {t.localizacao.estado}
                                    </span>
                                    {t.localizacao.bairro && (
                                      <span className="text-xs text-muted-foreground">{t.localizacao.bairro}</span>
                                    )}
                                </div>
                            ) : (
                                 <span className="text-xs text-muted-foreground italic mt-1">Localização não disponível</span>
                            )}
                        </div>
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
      )}
    </div>
  );
};
