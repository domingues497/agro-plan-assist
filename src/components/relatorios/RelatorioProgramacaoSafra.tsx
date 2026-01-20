import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSafras } from "@/hooks/useSafras";
import { useProdutores } from "@/hooks/useProdutores";
import { useFazendas } from "@/hooks/useFazendas";
import { useEpocas } from "@/hooks/useEpocas";
import { getApiBaseUrl } from "@/lib/utils";
import { Loader2, Printer } from "lucide-react";

export const RelatorioProgramacaoSafra = () => {
  const { safras } = useSafras() as any;
  const { data: produtores } = useProdutores();
  const { data: allFazendas } = useFazendas();
  const { data: epocas } = useEpocas();

  const [safraId, setSafraId] = useState("");
  const [produtorNumerocm, setProdutorNumerocm] = useState("");
  const [fazendaId, setFazendaId] = useState("");
  const [epocaId, setEpocaId] = useState("");

  const filteredFazendas = allFazendas?.filter(f => f.numerocm === produtorNumerocm) || [];

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["report-programacao-safra", safraId, produtorNumerocm, fazendaId, epocaId],
    queryFn: async () => {
      if (!safraId || !produtorNumerocm) return null;
      const baseUrl = getApiBaseUrl();
      const params = new URLSearchParams({
        safra_id: safraId,
        produtor_numerocm: produtorNumerocm,
      });
      if (fazendaId) params.append("fazenda_id", fazendaId);
      if (epocaId) params.append("epoca_id", epocaId);

      const res = await fetch(`${baseUrl}/reports/programacao_safra?${params}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: false, // Wait for user to click Generate
  });

  const handleGenerate = () => {
    if (safraId && produtorNumerocm) {
      refetch();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const programacoes = useMemo(() => {
    return data?.programacoes || [];
  }, [data]);

  return (
    <div className="space-y-6 print:space-y-2">
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Filtros do Relatório</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium">Safra</label>
              <Select value={safraId} onValueChange={setSafraId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a Safra" />
                </SelectTrigger>
                <SelectContent>
                  {safras?.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Produtor</label>
              <Select value={produtorNumerocm} onValueChange={(val) => { setProdutorNumerocm(val); setFazendaId(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o Produtor" />
                </SelectTrigger>
                <SelectContent>
                  {produtores?.map((p: any) => (
                    <SelectItem key={p.id} value={p.numerocm}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Fazenda</label>
              <Select value={fazendaId || "all"} onValueChange={(val) => setFazendaId(val === "all" ? "" : val)} disabled={!produtorNumerocm}>
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
            <div>
              <label className="text-sm font-medium">Época</label>
              <Select value={epocaId || "all"} onValueChange={(val) => setEpocaId(val === "all" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {epocas?.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleGenerate} disabled={isLoading || !safraId || !produtorNumerocm} className="w-full">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Gerar Relatório
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isError && (
        <div className="text-red-500 bg-red-50 p-4 rounded-md print:hidden">
          Erro ao carregar relatório: {String(error)}
        </div>
      )}

      {data && (
        <div className="space-y-8 print:p-0">
          <div className="flex justify-between items-center print:hidden">
            <h2 className="text-2xl font-bold">Resultados</h2>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
          </div>

          <div className="hidden print:block mb-8 text-center">
            <h1 className="text-3xl font-bold mb-2">Relatório de Programação de Safra</h1>
          </div>

          {programacoes.length === 0 ? (
            <p className="text-gray-500 italic">Nenhum dado encontrado para os filtros selecionados.</p>
          ) : (
            programacoes.map((prog: any) => (
              <div key={prog.id} className="mb-6 border rounded-lg p-4 bg-white shadow-sm break-inside-avoid">
                <div className="mb-4 pb-2 border-b">
                  <div className="flex justify-between items-start">
                    <h2 className="text-xl font-bold">{prog.produtor}</h2>
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">ID: {prog.id}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-2 text-sm text-gray-600 mt-2">
                    <span><strong>Safra:</strong> {prog.safra}</span>
                    <span><strong>Fazenda:</strong> {prog.fazenda} ({prog.area_total?.toFixed(2)} ha)</span>
                    <span><strong>Consultor:</strong> {prog.consultor || "-"}</span>
                    <span><strong>Época:</strong> {prog.epoca || "-"}</span>
                    <span><strong>Tipo:</strong> {prog.tipo || "-"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Coluna 1: Talhões */}
                  <div className="bg-orange-50/50 p-3 rounded">
                    <h3 className="text-sm font-semibold text-orange-800 mb-3 flex items-center">
                      <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                      Talhões ({prog.talhoes.length})
                    </h3>
                    <div className="space-y-2">
                      {prog.talhoes.map((t: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-sm border-b border-orange-100 pb-1 last:border-0">
                          <span>{t.nome}</span>
                          <span className="bg-white px-1 rounded border border-orange-100 text-xs text-gray-600">
                            {t.area?.toFixed(2)} ha
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Coluna 2: Cultivares */}
                  <div className="bg-green-50/50 p-3 rounded">
                    <h3 className="text-sm font-semibold text-green-800 mb-3 flex items-center">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                      Cultivares ({prog.cultivares.length})
                    </h3>
                    <div className="space-y-3">
                      {prog.cultivares.map((c: any, idx: number) => (
                        <div key={idx} className="text-sm border-b border-green-100 pb-2 last:border-0">
                          <div className="font-medium flex justify-between items-start">
                            <span>{c.cultivar}</span>
                            <span className="text-xs text-gray-500 bg-white px-1 rounded border border-green-100">{c.cultura}</span>
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                             {c.tratamento_display} {c.tipo_embalagem ? `(${c.tipo_embalagem})` : ""}
                          </div>
                          <div className="grid grid-cols-2 gap-1 mt-2 text-xs text-gray-700">
                            <span><strong>Área:</strong> {c.area_plantavel?.toFixed(2)} ha</span>
                            <span><strong>Pop:</strong> {c.populacao?.toLocaleString()}</span>
                            <span><strong>Cob:</strong> {c.cobertura}%</span>
                            <span><strong>Plantio:</strong> {c.data_plantio ? new Date(c.data_plantio).toLocaleDateString('pt-BR') : "-"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Coluna 3: Fertilizantes */}
                  <div className="bg-yellow-50/50 p-3 rounded">
                    <h3 className="text-sm font-semibold text-yellow-800 mb-3 flex items-center">
                      <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                      Fertilizantes ({prog.adubacao.length})
                    </h3>
                    <div className="space-y-3">
                      {prog.adubacao.map((a: any, idx: number) => (
                        <div key={idx} className="text-sm border-b border-yellow-100 pb-2 last:border-0">
                          <div className="font-medium">{a.formulacao}</div>
                          <div className="text-xs text-gray-500">{a.embalagem || "Big Bag"}</div>
                          <div className="grid grid-cols-2 gap-1 mt-2 text-xs text-gray-700">
                            <span><strong>Dose:</strong> {a.dose?.toFixed(0)} Kg/ha</span>
                            <span><strong>Cob:</strong> {a.cobertura}%</span>
                            <span><strong>Total:</strong> {a.total?.toLocaleString()} kg</span>
                            <span><strong>Aplic:</strong> {a.data_aplicacao ? new Date(a.data_aplicacao).toLocaleDateString('pt-BR') : "-"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Assinaturas */}
                  <div className="mt-8 pt-8 border-t grid grid-cols-2 gap-16 break-inside-avoid">
                    <div className="text-center">
                      <div className="border-b border-gray-400 mb-2"></div>
                      <p className="text-sm font-medium text-gray-700">{prog.produtor}</p>
                    </div>
                    <div className="text-center">
                      <div className="border-b border-gray-400 mb-2"></div>
                      <p className="text-sm font-medium text-gray-700">{prog.consultor || "Consultor"}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
