import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSafras } from "@/hooks/useSafras";
import { getApiBaseUrl } from "@/lib/utils";
import { Loader2, FileDown } from "lucide-react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { RelatorioPDF } from "./RelatorioPDF";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const RelatorioConsolidadoWrapper = () => {
  const [safraFilter, setSafraFilter] = useState<string>("");
  const [culturaFilter, setCulturaFilter] = useState<string>("");
  
  const { safras = [] } = useSafras() as any;
  const commonCulturas = ["SOJA", "MILHO", "TRIGO", "ALGODÃO", "FEIJÃO", "SORGO", "ARROZ"];

  const { data: consolidatedData, isLoading, refetch } = useQuery({
    queryKey: ["reports-consolidated", safraFilter, culturaFilter],
    enabled: false,
    queryFn: async () => {
        const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("auth_token") : null;
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const params = new URLSearchParams();
        if (safraFilter) params.append("safra_id", safraFilter);
        if (culturaFilter && culturaFilter !== "all") params.append("cultura", culturaFilter);
        
        const res = await fetch(`${getApiBaseUrl()}/reports/consolidated?${params.toString()}`, { headers });
        if (!res.ok) throw new Error("Erro ao buscar consolidados");
        return res.json();
    }
  });

  const resumo = useMemo(() => {
    if (!consolidatedData) return null;

    return {
      cultivares: consolidatedData.cultivares_count,
      quantidadeSementes: consolidatedData.sementes_total,
      hectares: consolidatedData.area_total_ha,
      adubacoes: consolidatedData.adubacoes_count,
      volumeAdubacao: consolidatedData.adubo_total_kg,
      defensivos: consolidatedData.defensivos_count,
      volumeDefensivo: 0, 
      safras: safraFilter ? [(safras || []).find((s: any) => String(s.id) === safraFilter)?.nome || safraFilter] : [],
    };
  }, [consolidatedData, safraFilter, safras]);

  const handleGenerate = () => {
    if (safraFilter) {
      refetch();
    }
  };

  return (
    <div className="space-y-6">
       <Card>
        <CardHeader>
          <CardTitle>Filtros - Consolidado da Safra</CardTitle>
        </CardHeader>
        <CardContent>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="text-sm font-medium mb-1 block">Safra</label>
                  <Select value={safraFilter} onValueChange={setSafraFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma safra..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(safras || []).map((s: any) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                   <label className="text-sm font-medium mb-1 block">Cultura</label>
                   <Select value={culturaFilter} onValueChange={setCulturaFilter}>
                      <SelectTrigger>
                         <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                         <SelectItem value="all">Todas</SelectItem>
                         {commonCulturas.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                         ))}
                      </SelectContent>
                   </Select>
                </div>
                <Button onClick={handleGenerate} disabled={isLoading || !safraFilter}>
                   {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                   Gerar Relatório
                </Button>
             </div>
        </CardContent>
       </Card>

       {resumo && (
        <Card>
            <CardHeader>
              <CardTitle>Resultados</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-secondary/20 p-3 rounded-md">
                      <p className="text-xs text-muted-foreground">Área Total</p>
                      <p className="text-lg font-bold">{resumo.hectares.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ha</p>
                    </div>
                    <div className="bg-secondary/20 p-3 rounded-md">
                      <p className="text-xs text-muted-foreground">Sementes</p>
                      <p className="text-lg font-bold">{resumo.quantidadeSementes.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</p>
                    </div>
                    <div className="bg-secondary/20 p-3 rounded-md">
                      <p className="text-xs text-muted-foreground">Adubo Total</p>
                      <p className="text-lg font-bold">{resumo.volumeAdubacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</p>
                    </div>
                    <div className="bg-secondary/20 p-3 rounded-md">
                      <p className="text-xs text-muted-foreground">Defensivos (Doses)</p>
                      <p className="text-lg font-bold">{resumo.defensivos.toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                  
                  <PDFDownloadLink
                    document={
                      <RelatorioPDF
                        data={{
                          ...resumo,
                          safra: (safras || []).find((s: any) => String(s.id) === safraFilter)?.nome || ""
                        }}
                      />
                    }
                    fileName={`relatorio_consolidado_${safraFilter || 'geral'}.pdf`}
                  >
                    {({ loading }) => (
                      <Button className="w-full" disabled={loading}>
                        <FileDown className="mr-2 h-4 w-4" />
                        {loading ? 'Gerando PDF...' : 'Baixar PDF Consolidado'}
                      </Button>
                    )}
                  </PDFDownloadLink>
                </div>
            </CardContent>
        </Card>
       )}
    </div>
  );
};
