import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSafras } from "@/hooks/useSafras";
import { getApiBaseUrl } from "@/lib/utils";
import { Loader2, Printer } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
                <div className="flex items-end lg:col-span-3">
                    <Button onClick={handleGenerate} disabled={isLoading || !safraFilter} className="w-full md:w-auto">
                       {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                       Gerar Relatório
                    </Button>
                </div>
             </div>
        </CardContent>
       </Card>

       {summaryConsultorData && summaryConsultorData.length > 0 && (
        <div className="space-y-8 print:p-0">
            <div className="hidden print:block mb-8 text-center">
                 <h1 className="text-3xl font-bold mb-2">Relatório Resumo Consultor/Produtor</h1>
                 <p className="text-gray-600">
                     Safra: {(safras || []).find((s: any) => String(s.id) === safraFilter)?.nome || safraFilter} | 
                     Cultura: {culturaFilter === "all" || !culturaFilter ? "Todas" : culturaFilter}
                 </p>
            </div>

            <div className="flex justify-between items-center print:hidden">
                 <h2 className="text-2xl font-bold">Resultados ({summaryConsultorData.length})</h2>
                 <Button variant="outline" onClick={handlePrint}>
                     <Printer className="mr-2 h-4 w-4" /> Imprimir
                 </Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Consultor</TableHead>
                                    <TableHead>Produtor</TableHead>
                                    <TableHead className="text-right">Área Física (ha)</TableHead>
                                    <TableHead className="text-right">Área Programada (ha)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {summaryConsultorData.map((item: any, idx: number) => (
                                    <TableRow key={idx}>
                                        <TableCell>{item.consultor}</TableCell>
                                        <TableCell>{item.produtor}</TableCell>
                                        <TableCell className="text-right">{item.area_fisica?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                        <TableCell className="text-right">{item.area_programada?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
       )}
    </div>
  );
};
