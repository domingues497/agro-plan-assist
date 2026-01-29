import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSafras } from "@/hooks/useSafras";
import { getApiBaseUrl } from "@/lib/utils";
import { Loader2, FileDown } from "lucide-react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { RelatorioResumoConsultorProdutorPDF } from "./RelatorioResumoConsultorProdutorPDF";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const RelatorioResumoConsultorWrapper = () => {
  const [safraFilter, setSafraFilter] = useState<string>("");
  const [culturaFilter, setCulturaFilter] = useState<string>("");
  
  const { safras = [] } = useSafras() as any;
  const commonCulturas = ["SOJA", "MILHO", "TRIGO", "ALGODÃO", "FEIJÃO", "SORGO", "ARROZ"];

  const { data: summaryConsultorData = [], isLoading, refetch } = useQuery({
    queryKey: ["reports-summary-consultor", safraFilter, culturaFilter],
    enabled: false,
    queryFn: async () => {
        const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("auth_token") : null;
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const params = new URLSearchParams();
        if (safraFilter) params.append("safra_id", safraFilter);
        if (culturaFilter && culturaFilter !== "all") params.append("cultura", culturaFilter);
        
        const res = await fetch(`${getApiBaseUrl()}/reports/consultor_produtor_summary?${params.toString()}`, { headers });
        if (!res.ok) throw new Error("Erro ao buscar resumo consultor");
        return res.json();
    }
  });

  const handleGenerate = () => {
    if (safraFilter) {
      refetch();
    }
  };

  return (
    <div className="space-y-6">
       <Card>
        <CardHeader>
          <CardTitle>Filtros - Resumo Consultor/Produtor</CardTitle>
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

       {summaryConsultorData && summaryConsultorData.length > 0 && (
        <Card>
            <CardHeader>
              <CardTitle>Resultados</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                  <div className="border rounded-md">
                     <div className="grid grid-cols-4 bg-muted p-2 font-medium text-sm">
                        <div>Consultor</div>
                        <div>Produtor</div>
                        <div className="text-right">Área Física (ha)</div>
                        <div className="text-right">Área Programada (ha)</div>
                     </div>
                     <div className="divide-y max-h-[400px] overflow-y-auto">
                        {summaryConsultorData.map((item: any, idx: number) => (
                           <div key={idx} className="grid grid-cols-4 p-2 text-sm hover:bg-muted/50">
                              <div>{item.consultor}</div>
                              <div>{item.produtor}</div>
                              <div className="text-right">{item.area_fisica?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                              <div className="text-right">{item.area_programada?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                           </div>
                        ))}
                     </div>
                  </div>

                  <PDFDownloadLink
                    document={
                      <RelatorioResumoConsultorProdutorPDF
                        data={summaryConsultorData}
                        safra={(safras || []).find((s: any) => String(s.id) === safraFilter)?.nome || ""}
                        cultura={culturaFilter === "all" ? "Todas" : culturaFilter}
                      />
                    }
                    fileName={`resumo_consultor_${safraFilter || 'geral'}.pdf`}
                  >
                    {({ loading }) => (
                      <Button className="w-full" disabled={loading}>
                        <FileDown className="mr-2 h-4 w-4" />
                        {loading ? 'Gerando PDF...' : 'Baixar PDF Resumo'}
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
