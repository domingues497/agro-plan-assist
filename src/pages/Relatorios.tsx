import { Link } from "react-router-dom";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ArrowLeft, Map, Users, FileSpreadsheet, ClipboardList, PieChart } from "lucide-react";
import { RelatorioProgramacaoSafra } from "@/components/relatorios/RelatorioProgramacaoSafra";
import { RelatorioMapaFazendas } from "@/components/relatorios/RelatorioMapaFazendas";
import { RelatorioConsolidadoWrapper } from "@/components/relatorios/RelatorioConsolidadoWrapper";
import { RelatorioDetalhadoWrapper } from "@/components/relatorios/RelatorioDetalhadoWrapper";
import { RelatorioDetalhadoConsultorWrapper } from "@/components/relatorios/RelatorioDetalhadoConsultorWrapper";
import { RelatorioProdutoresWrapper } from "@/components/relatorios/RelatorioProdutoresWrapper";
import { RelatorioResumoConsultorWrapper } from "@/components/relatorios/RelatorioResumoConsultorWrapper";

type ViewMode = 
  | "default" 
  | "programacao_safra" 
  | "mapa_fazendas"
  | "consolidado"
  | "detalhado_produtor"
  | "detalhado_consultor"
  | "resumo_consultor"
  | "lista_produtores";

const Relatorios = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("default");

  const renderContent = () => {
    switch (viewMode) {
      case "programacao_safra":
        return <RelatorioProgramacaoSafra />;
      case "mapa_fazendas":
        return <RelatorioMapaFazendas />;
      case "consolidado":
        return <RelatorioConsolidadoWrapper />;
      case "detalhado_produtor":
        return <RelatorioDetalhadoWrapper />;
      case "detalhado_consultor":
        return <RelatorioDetalhadoConsultorWrapper />;
      case "resumo_consultor":
        return <RelatorioResumoConsultorWrapper />;
      case "lista_produtores":
        return <RelatorioProdutoresWrapper />;
      default:
        return null;
    }
  };

  const getTitle = () => {
    switch (viewMode) {
      case "programacao_safra": return "Relatório de Programação de Safra";
      case "mapa_fazendas": return "Relatório Mapa de Fazendas";
      case "consolidado": return "Consolidado da Safra";
      case "detalhado_produtor": return "Relatório Detalhado (Produtor)";
      case "detalhado_consultor": return "Relatório Detalhado (Consultor)";
      case "resumo_consultor": return "Resumo Consultor/Produtor";
      case "lista_produtores": return "Lista de Produtores";
      default: return "Relatórios";
    }
  };

  if (viewMode !== "default") {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card print:hidden">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <h1 className="text-xl font-bold">{getTitle()}</h1>
              <div className="ml-auto">
                <Button variant="outline" onClick={() => setViewMode("default")}>
                  Voltar para Relatório Geral
                </Button>
              </div>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          {renderContent()}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <FileText className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold">Relatórios</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          
          <Card className="p-6 cursor-pointer hover:shadow-md transition-shadow border-primary/20 bg-primary/5" onClick={() => setViewMode("programacao_safra")}>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Programação de Safra</h3>
                <p className="text-sm text-muted-foreground">Relatório por Safra, Produtor, Fazenda e Época</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 cursor-pointer hover:shadow-md transition-shadow border-primary/20 bg-primary/5" onClick={() => setViewMode("consolidado")}>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <PieChart className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Consolidado da Safra</h3>
                <p className="text-sm text-muted-foreground">Totais de sementes, áreas e insumos por Safra</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 cursor-pointer hover:shadow-md transition-shadow border-primary/20 bg-primary/5" onClick={() => setViewMode("detalhado_produtor")}>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <FileSpreadsheet className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Detalhado (Produtor)</h3>
                <p className="text-sm text-muted-foreground">Relatório completo por Produtor com todos os insumos</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 cursor-pointer hover:shadow-md transition-shadow border-primary/20 bg-primary/5" onClick={() => setViewMode("detalhado_consultor")}>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Detalhado (Consultor)</h3>
                <p className="text-sm text-muted-foreground">Relatório completo agrupado por Consultor</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 cursor-pointer hover:shadow-md transition-shadow border-primary/20 bg-primary/5" onClick={() => setViewMode("resumo_consultor")}>
             <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <ClipboardList className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Resumo Consultor/Produtor</h3>
                <p className="text-sm text-muted-foreground">Visão resumida de áreas e insumos por Consultor</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 cursor-pointer hover:shadow-md transition-shadow border-primary/20 bg-primary/5" onClick={() => setViewMode("mapa_fazendas")}>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Map className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Mapa de Fazendas</h3>
                <p className="text-sm text-muted-foreground">Visualização geográfica das fazendas</p>
              </div>
            </div>
          </Card>

           <Card className="p-6 cursor-pointer hover:shadow-md transition-shadow border-primary/20 bg-primary/5" onClick={() => setViewMode("lista_produtores")}>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Lista de Produtores</h3>
                <p className="text-sm text-muted-foreground">Listagem e exportação de produtores cadastrados</p>
              </div>
            </div>
          </Card>

        </div>
      </main>
    </div>
  );
};

export default Relatorios;
