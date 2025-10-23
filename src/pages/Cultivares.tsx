import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sprout, ArrowLeft, Plus } from "lucide-react";
import { Link } from "react-router-dom";

const Cultivares = () => {
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
              <Sprout className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Cultivares</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Gestão de Cultivares</h2>
            <p className="text-muted-foreground">Programação de plantio por área e safra</p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nova Programação
          </Button>
        </div>

        <Card className="p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Filtros</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Safra</Label>
              <Input placeholder="2024/2025" />
            </div>
            <div className="space-y-2">
              <Label>Cultura</Label>
              <Input placeholder="Soja, Milho..." />
            </div>
            <div className="space-y-2">
              <Label>Área</Label>
              <Input placeholder="Área 1, 2..." />
            </div>
          </div>
          <Button className="mt-4">Buscar</Button>
        </Card>

        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Sprout className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-lg">Soja TMG 7067 IPRO</h3>
                  </div>
                  <div className="grid gap-2 text-sm text-muted-foreground">
                    <p><span className="font-medium">Área:</span> Talhão A{i} - 45.3 ha</p>
                    <p><span className="font-medium">Quantidade:</span> 850 kg (68 sc)</p>
                    <p><span className="font-medium">Data Plantio:</span> 15/10/2024</p>
                    <p><span className="font-medium">Safra:</span> 2024/2025</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">Editar</Button>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Cultivares;
