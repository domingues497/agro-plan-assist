import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Droplet, ArrowLeft, Plus } from "lucide-react";
import { Link } from "react-router-dom";

const Adubacao = () => {
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
              <Droplet className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Adubação</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Programação de Adubação</h2>
            <p className="text-muted-foreground">Planejar formulações NPK e doses por hectare</p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nova Adubação
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
              <Label>Formulação</Label>
              <Input placeholder="NPK 10-20-20..." />
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
                    <Droplet className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-lg">NPK 10-20-20</h3>
                  </div>
                  <div className="grid gap-2 text-sm text-muted-foreground">
                    <p><span className="font-medium">Área:</span> Talhão B{i} - 38.5 ha</p>
                    <p><span className="font-medium">Dose:</span> 350 kg/ha</p>
                    <p><span className="font-medium">Total:</span> 13,475 kg</p>
                    <p><span className="font-medium">Data Aplicação:</span> 20/10/2024</p>
                    <p><span className="font-medium">Responsável:</span> João Silva</p>
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

export default Adubacao;
