import { useState, useMemo } from "react";
import { Produtor } from "@/hooks/useProdutores";
import { Button } from "@/components/ui/button";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { RelatorioProdutoresPDF } from "./RelatorioProdutoresPDF";
import * as XLSX from "xlsx";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

interface RelatorioProdutoresProps {
  produtores: Produtor[];
}

export const RelatorioProdutores = ({ produtores }: RelatorioProdutoresProps) => {
  const [isExporting, setIsExporting] = useState(false);

  const sortedProdutores = useMemo(() => {
    return [...produtores].sort((a, b) => {
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
  }, [produtores]);

  const formatBoolean = (value?: boolean) => value ? "Sim" : "Não";

  const getCooperadoStatus = (produtor: Produtor) => {
    const isClosed = produtor.compra_insumos && produtor.entrega_producao && produtor.paga_assistencia;
    return isClosed ? "FECHADO" : "ABERTO";
  };

  const exportToExcel = () => {
    setIsExporting(true);
    try {
      const data = sortedProdutores.map((p) => ({
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
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-bold">
          Relatório de Produtores
        </CardTitle>
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
            document={<RelatorioProdutoresPDF produtores={sortedProdutores} />}
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
    </Card>
  );
};
