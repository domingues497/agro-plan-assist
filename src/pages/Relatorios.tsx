import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ArrowLeft, Download } from "lucide-react";
import { Link } from "react-router-dom";

const Relatorios = () => {
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
              <h1 className="text-xl font-bold">Relatórios</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground">Relatórios Consolidados</h2>
          <p className="text-muted-foreground">Visualize dados e exporte relatórios</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Custo por Cultura</h3>
            <div className="space-y-3 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Soja</span>
                <span className="font-semibold">R$ 156.780,00</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Milho</span>
                <span className="font-semibold">R$ 89.340,00</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Trigo</span>
                <span className="font-semibold">R$ 45.120,00</span>
              </div>
            </div>
            <Button className="w-full" variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exportar PDF
            </Button>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Custo por Tipo de Insumo</h3>
            <div className="space-y-3 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Sementes</span>
                <span className="font-semibold">R$ 98.450,00</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Adubos</span>
                <span className="font-semibold">R$ 112.290,00</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Defensivos</span>
                <span className="font-semibold">R$ 80.500,00</span>
              </div>
            </div>
            <Button className="w-full" variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exportar Excel
            </Button>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Áreas Programadas</h3>
            <div className="space-y-3 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total de Áreas</span>
                <span className="font-semibold">18</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Hectares Totais</span>
                <span className="font-semibold">842.5 ha</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Safra Atual</span>
                <span className="font-semibold">2024/2025</span>
              </div>
            </div>
            <Button className="w-full" variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exportar PDF
            </Button>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Programações por Safra</h3>
            <div className="space-y-3 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">2024/2025</span>
                <span className="font-semibold">35 programações</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">2023/2024</span>
                <span className="font-semibold">42 programações</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">2022/2023</span>
                <span className="font-semibold">38 programações</span>
              </div>
            </div>
            <Button className="w-full" variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exportar Excel
            </Button>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Relatorios;
