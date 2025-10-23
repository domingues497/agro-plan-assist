import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, ArrowLeft, Plus } from "lucide-react";
import { fetchDefensivos } from "@/lib/api";

const Defensivos = () => {
  const {
    data: defensivos,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["defensivos", { limit: 100 }],
    queryFn: () => fetchDefensivos(100),
  });

  const defensivosList = defensivos ?? [];

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
              <Shield className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Defensivos</h1>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              Atualizar
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Programacao de defensivos</h2>
            <p className="text-muted-foreground">Aplicacoes quimicas planejadas por area</p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nova aplicacao
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
              <Label>Alvo</Label>
              <Input placeholder="Praga, doenca..." />
            </div>
            <div className="space-y-2">
              <Label>Defensivo</Label>
              <Input placeholder="Inseticida, Fungicida..." />
            </div>
          </div>
          <Button className="mt-4">Buscar</Button>
        </Card>

        {isLoading ? (
          <p className="text-muted-foreground">Carregando defensivos...</p>
        ) : error ? (
          <Card className="p-6 border-destructive text-destructive">
            Ocorreu um erro ao carregar os dados. Tente novamente.
          </Card>
        ) : (
          <div className="grid gap-4">
            {defensivosList.length === 0 ? (
              <Card className="p-6">
                <p className="text-muted-foreground">Nenhuma aplicacao cadastrada.</p>
              </Card>
            ) : (
              defensivosList.map((item, index) => (
                <Card key={index} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Shield className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold text-lg">
                          {String(item.defensivo ?? item.DEFENSIVO ?? "Defensivo nao informado")}
                        </h3>
                      </div>
                      <div className="grid gap-2 text-sm text-muted-foreground">
                        <p>
                          <span className="font-medium">Area:</span>{" "}
                          {String(item.area ?? item.AREA ?? "-")}
                        </p>
                        <p>
                          <span className="font-medium">Dose:</span>{" "}
                          {String(item.dose ?? item.DOSE ?? "-")}
                        </p>
                        <p>
                          <span className="font-medium">Data aplicacao:</span>{" "}
                          {String(item.data_aplicacao ?? item.DATA_APLICACAO ?? "-")}
                        </p>
                        <p>
                          <span className="font-medium">Alvo:</span>{" "}
                          {String(item.alvo ?? item.ALVO ?? "-")}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Editar
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Defensivos;
