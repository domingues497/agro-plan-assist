import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProdutores, Produtor } from "@/hooks/useProdutores";
import { Loader2, Download, FileSpreadsheet, Check, ChevronsUpDown } from "lucide-react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { RelatorioProdutoresPDF } from "./RelatorioProdutoresPDF";
import * as XLSX from "xlsx";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const RelatorioProdutoresWrapper = () => {
  const [consultorFilter, setConsultorFilter] = useState<string>("all");
  const [openConsultorCombobox, setOpenConsultorCombobox] = useState(false);
  const [generatedData, setGeneratedData] = useState<Produtor[] | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const { data: produtores = [], isLoading: isLoadingProdutores } = useProdutores();

  const consultores = useMemo(() => {
    const list = new Set<string>();
    produtores.forEach((p: any) => {
      if (p.consultor) list.add(p.consultor);
    });
    return Array.from(list).sort();
  }, [produtores]);

  const handleGenerate = () => {
    let filtered = produtores;
    if (consultorFilter !== "all") {
        filtered = produtores.filter((p: any) => p.consultor === consultorFilter);
    }
    
    // Sort logic
    filtered = [...filtered].sort((a: any, b: any) => {
      // Sort by Consultor (primary)
      const consultorA = (a.consultor || "").toLowerCase();
      const consultorB = (b.consultor || "").toLowerCase();
      
      if (consultorA < consultorB) return -1;
      if (consultorA > consultorB) return 1;
      
      // Sort by Nome (secondary)
      const nomeA = (a.nome || "").toLowerCase();
      const nomeB = (b.nome || "").toLowerCase();
      
      if (nomeA < nomeB) return -1;
      if (nomeA > nomeB) return 1;
      
      return 0;
    });

    setGeneratedData(filtered);
  };

  const formatBoolean = (value?: boolean) => value ? "Sim" : "Não";

  const getCooperadoStatus = (produtor: Produtor) => {
    const isClosed = produtor.compra_insumos && produtor.entrega_producao && produtor.paga_assistencia;
    return isClosed ? "FECHADO" : "ABERTO";
  };

  const exportToExcel = () => {
    if (!generatedData) return;
    setIsExporting(true);
    try {
      const data = generatedData.map((p) => ({
        "Número CM": p.numerocm,
        "Nome": p.nome,
        "Consultor": p.consultor || "",
        "Compra Insumos": formatBoolean(p.compra_insumos),
        "Entrega Produção": formatBoolean(p.entrega_producao),
        "Paga Assistência": formatBoolean(p.paga_assistencia),
        "Cooperado": getCooperadoStatus(p),
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Produtores");
      XLSX.writeFile(wb, "relatorio_produtores.xlsx");
    } catch (error) {
      console.error("Erro ao exportar Excel:", error);
    } finally {
      setIsExporting(false);
    }
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
              <label className="text-sm font-medium">Consultor</label>
              <Popover open={openConsultorCombobox} onOpenChange={setOpenConsultorCombobox}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={openConsultorCombobox} className="w-full justify-between">
                    {consultorFilter === "all"
                      ? "Todos"
                      : consultorFilter}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar consultor..." />
                    <CommandList>
                      <CommandEmpty>Nenhum consultor encontrado.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem value="all" onSelect={() => { setConsultorFilter("all"); setOpenConsultorCombobox(false); }}>
                            <Check className={cn("mr-2 h-4 w-4", consultorFilter === "all" ? "opacity-100" : "opacity-0")} />
                            Todos
                        </CommandItem>
                        {consultores.map((c) => (
                          <CommandItem
                            key={c}
                            value={c}
                            onSelect={() => {
                              setConsultorFilter(c);
                              setOpenConsultorCombobox(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                consultorFilter === c ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {c}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-end gap-2 lg:col-span-4">
              <Button onClick={handleGenerate} disabled={isLoadingProdutores} className="w-full md:w-auto">
                {isLoadingProdutores ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Gerar Relatório
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {generatedData && (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>Resultados ({generatedData.length})</CardTitle>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={exportToExcel}
                        disabled={isExporting}
                    >
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                        Excel
                    </Button>
                    
                    <PDFDownloadLink
                        document={<RelatorioProdutoresPDF produtores={generatedData} />}
                        fileName="relatorio_produtores.pdf"
                    >
                        {({ loading }) => (
                        <Button variant="outline" size="sm" disabled={loading}>
                            <FileDown className="mr-2 h-4 w-4" />
                            PDF
                        </Button>
                        )}
                    </PDFDownloadLink>
                </div>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <div className="w-full overflow-auto">
                        <table className="w-full caption-bottom text-sm">
                            <thead className="[&_tr]:border-b">
                                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Número CM</th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Nome</th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Consultor</th>
                                    <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">Compra Insumos</th>
                                    <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">Entrega Produção</th>
                                    <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">Paga Assistência</th>
                                    <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">Status</th>
                                </tr>
                            </thead>
                            <tbody className="[&_tr:last-child]:border-0">
                                {generatedData.map((produtor) => (
                                    <tr key={produtor.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                        <td className="p-4 align-middle">{produtor.numerocm}</td>
                                        <td className="p-4 align-middle font-medium">{produtor.nome}</td>
                                        <td className="p-4 align-middle">{produtor.consultor}</td>
                                        <td className="p-4 align-middle text-center">{formatBoolean(produtor.compra_insumos)}</td>
                                        <td className="p-4 align-middle text-center">{formatBoolean(produtor.entrega_producao)}</td>
                                        <td className="p-4 align-middle text-center">{formatBoolean(produtor.paga_assistencia)}</td>
                                        <td className="p-4 align-middle text-center">
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                                                getCooperadoStatus(produtor) === "FECHADO" 
                                                ? "bg-green-100 text-green-800" 
                                                : "bg-yellow-100 text-yellow-800"
                                            }`}>
                                                {getCooperadoStatus(produtor)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </CardContent>
        </Card>
      )}
    </div>
  );
};

import { FileDown } from "lucide-react";
