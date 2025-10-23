import { Link } from "react-router-dom";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ArrowLeft, Download } from "lucide-react";
import { fetchAdubacoes, fetchCultivares, fetchDefensivos } from "@/lib/api";

const parseNumber = (value: unknown): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const Relatorios = () => {
  const { data: cultivares } = useQuery({
    queryKey: ["cultivares", { limit: 200 }],
    queryFn: () => fetchCultivares(200),
  });

  const { data: adubacoes } = useQuery({
    queryKey: ["adubacoes", { limit: 200 }],
    queryFn: () => fetchAdubacoes(200),
  });

  const { data: defensivos } = useQuery({
    queryKey: ["defensivos", { limit: 200 }],
    queryFn: () => fetchDefensivos(200),
  });

  const cultivaresList = cultivares ?? [];
  const adubacoesList = adubacoes ?? [];
  const defensivosList = defensivos ?? [];

  const resumo = useMemo(() => {
    const totalQuantidade = cultivaresList.reduce(
      (acc, item) => acc + parseNumber(item.quantidade ?? item.QUANTIDADE),
      0
    );

    const totalHectares = cultivaresList.reduce((acc, item) => {
      const areaValue = item.area ?? item.AREA;
      const match = typeof areaValue === "string" ? areaValue.match(/(\d+(\.\d+)?)/) : null;
      if (match) {
        return acc + parseFloat(match[1]);
      }
      return acc;
    }, 0);

    const totalAdubacao = adubacoesList.reduce(
      (acc, item) => acc + parseNumber(item.total ?? item.TOTAL),
      0
    );

    const totalDefensivo = defensivosList.reduce(
      (acc, item) => acc + parseNumber(item.dose ?? item.DOSE),
      0
    );

    const safras = new Set<string>();
    cultivaresList.forEach((item) => {
      const safra = String(item.safra ?? item.SAFRA ?? "").trim();
      if (safra) {
        safras.add(safra);
      }
    });

    return {
      cultivares: cultivaresList.length,
      quantidadeSementes: totalQuantidade,
      hectares: totalHectares,
      adubacoes: adubacoesList.length,
      volumeAdubacao: totalAdubacao,
      defensivos: defensivosList.length,
      volumeDefensivo: totalDefensivo,
      safras: Array.from(safras),
    };
  }, [cultivaresList, adubacoesList, defensivosList]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Relatorios</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground">Relatorios consolidados</h2>
          <p className="text-muted-foreground">
            Visualize dados consolidados a partir do banco Oracle
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Resumo de cultivares</h3>
            <div className="space-y-3 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Cultivares</span>
                <span className="font-semibold">{resumo.cultivares}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Quantidade total</span>
                <span className="font-semibold">{resumo.quantidadeSementes.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Hectares identificados</span>
                <span className="font-semibold">{resumo.hectares.toFixed(2)} ha</span>
              </div>
            </div>
            <Button className="w-full" variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Resumo de adubacoes</h3>
            <div className="space-y-3 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Programacoes</span>
                <span className="font-semibold">{resumo.adubacoes}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Volume total</span>
                <span className="font-semibold">{resumo.volumeAdubacao.toFixed(2)}</span>
              </div>
            </div>
            <Button className="w-full" variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exportar PDF
            </Button>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Resumo de defensivos</h3>
            <div className="space-y-3 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Aplicacoes</span>
                <span className="font-semibold">{resumo.defensivos}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Volume total</span>
                <span className="font-semibold">{resumo.volumeDefensivo.toFixed(2)}</span>
              </div>
            </div>
            <Button className="w-full" variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exportar Excel
            </Button>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Safras monitoradas</h3>
            <div className="space-y-3 mb-4">
              {resumo.safras.length === 0 ? (
                <p className="text-muted-foreground">Nenhuma safra identificada nas consultas.</p>
              ) : (
                resumo.safras.map((safra) => (
                  <div key={safra} className="flex justify-between items-center">
                    <span className="text-muted-foreground">{safra}</span>
                    <span className="font-semibold">
                      {
                        cultivaresList.filter(
                          (item) => String(item.safra ?? item.SAFRA ?? "") === safra
                        ).length
                      }
                    </span>
                  </div>
                ))
              )}
            </div>
            <Button className="w-full" variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exportar resumo
            </Button>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Relatorios;

