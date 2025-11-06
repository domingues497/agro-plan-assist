import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowLeft, Trash2 } from "lucide-react";
import { useProgramacoes } from "@/hooks/useProgramacoes";
import { FormProgramacao } from "@/components/programacao/FormProgramacao";
import { useFazendas } from "@/hooks/useFazendas";
import { useProdutores } from "@/hooks/useProdutores";

export default function Programacao() {
  const [showForm, setShowForm] = useState(false);
  const { programacoes, isLoading, create, delete: deleteProgramacao } = useProgramacoes();
  const { data: fazendas = [] } = useFazendas();
  const { data: produtores = [] } = useProdutores();

  const temAreasCadastradas = fazendas.length > 0;

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
              <Calendar className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Programação</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Programação de Cultivares e Adubação</h1>
            <p className="text-muted-foreground">Planejamento completo de sementes e fertilizantes</p>
          </div>
          <Button 
            onClick={() => setShowForm(true)}
            disabled={!temAreasCadastradas}
          >
            Nova Programação
          </Button>
        </div>

        {!temAreasCadastradas && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800 font-medium">
              ⚠️ Não há áreas cadastradas. Por favor, cadastre fazendas antes de criar programações.
            </p>
          </div>
        )}

        {showForm && (
          <FormProgramacao
            onSubmit={(data) => {
              create(data);
              setShowForm(false);
            }}
            onCancel={() => setShowForm(false)}
          />
        )}

        {isLoading ? (
          <p className="text-muted-foreground">Carregando programações...</p>
        ) : (
          <div className="grid gap-4">
            {programacoes.length === 0 ? (
              <Card className="p-6">
                <p className="text-muted-foreground">Nenhuma programação encontrada.</p>
              </Card>
            ) : (
              programacoes.map((prog) => {
                const produtor = produtores.find(p => p.numerocm === prog.produtor_numerocm);
                const fazenda = fazendas.find(f => f.idfazenda === prog.fazenda_idfazenda);
                
                return (
                  <Card key={prog.id} className="p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <Calendar className="h-5 w-5 text-primary" />
                          <h3 className="font-semibold text-lg">
                            {prog.produtor_numerocm} - {produtor?.nome || ""}
                          </h3>
                        </div>
                        
                        <div className="grid gap-2 text-sm text-muted-foreground">
                          <p>
                            <span className="font-medium">Fazenda:</span> {fazenda?.nomefazenda || prog.fazenda_idfazenda}
                          </p>
                          <p>
                            <span className="font-medium">Área:</span> {prog.area} ({prog.area_hectares} ha)
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Criado em: {new Date(prog.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>
                      
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => deleteProgramacao(prog.id)}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </main>
    </div>
  );
}
