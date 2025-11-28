import { useState } from "react";
import { useUsuarios } from "@/hooks/useUsuarios";
import { useUserProdutores } from "@/hooks/useUserProdutores";
import { useUserFazendas } from "@/hooks/useUserFazendas";
import { useProdutores } from "@/hooks/useProdutores";
import { useFazendas } from "@/hooks/useFazendas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

export const GerenciarGestores = () => {
  const { usuarios, isLoading: loadingUsuarios } = useUsuarios();
  const { data: produtores, isLoading: loadingProdutores } = useProdutores();
  const { data: fazendas, isLoading: loadingFazendas } = useFazendas();

  const [selectedGestor, setSelectedGestor] = useState<string>("");
  const [selectedProdutores, setSelectedProdutores] = useState<string[]>([]);
  const [selectedFazendas, setSelectedFazendas] = useState<string[]>([]);

  const {
    produtores: gestorProdutores,
    addProdutor,
    removeProdutor,
    isAdding: addingProdutor,
  } = useUserProdutores(selectedGestor);

  const {
    fazendas: gestorFazendas,
    addFazenda,
    removeFazenda,
    isAdding: addingFazenda,
  } = useUserFazendas(selectedGestor);

  const gestores = usuarios?.filter((u) => u.role === "gestor") ?? [];

  const availableProdutores = produtores?.filter(
    (p) => !gestorProdutores.some((gp) => gp.produtor_numerocm === p.numerocm)
  ) ?? [];

  const availableFazendas = fazendas?.filter(
    (f) => !gestorFazendas.some((gf) => gf.fazenda_id === f.id)
  ) ?? [];

  const handleToggleProdutor = (numerocm: string) => {
    setSelectedProdutores((prev) =>
      prev.includes(numerocm)
        ? prev.filter((id) => id !== numerocm)
        : [...prev, numerocm]
    );
  };

  const handleToggleFazenda = (id: string) => {
    setSelectedFazendas((prev) =>
      prev.includes(id) ? prev.filter((fId) => fId !== id) : [...prev, id]
    );
  };

  const handleSelectAllProdutores = () => {
    if (selectedProdutores.length === availableProdutores.length) {
      setSelectedProdutores([]);
    } else {
      setSelectedProdutores(availableProdutores.map((p) => p.numerocm));
    }
  };

  const handleSelectAllFazendas = () => {
    if (selectedFazendas.length === availableFazendas.length) {
      setSelectedFazendas([]);
    } else {
      setSelectedFazendas(availableFazendas.map((f) => f.id));
    }
  };

  const handleAddProdutores = async () => {
    if (selectedGestor && selectedProdutores.length > 0) {
      for (const produtorNumerocm of selectedProdutores) {
        addProdutor({
          userId: selectedGestor,
          produtorNumerocm,
        });
      }
      setSelectedProdutores([]);
    }
  };

  const handleAddFazendas = async () => {
    if (selectedGestor && selectedFazendas.length > 0) {
      for (const fazendaId of selectedFazendas) {
        addFazenda({
          userId: selectedGestor,
          fazendaId,
        });
      }
      setSelectedFazendas([]);
    }
  };

  if (loadingUsuarios || loadingProdutores || loadingFazendas) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gerenciar Associações de Gestores</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Selecione um Gestor
            </label>
            <Select value={selectedGestor} onValueChange={setSelectedGestor}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um gestor" />
              </SelectTrigger>
              <SelectContent>
                {gestores.map((gestor) => (
                  <SelectItem key={gestor.id} value={gestor.id}>
                    {gestor.nome || gestor.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedGestor && (
            <>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    Produtores Associados
                  </h3>
                  
                  {availableProdutores.length > 0 && (
                    <div className="mb-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="select-all-produtores"
                            checked={
                              selectedProdutores.length ===
                                availableProdutores.length &&
                              availableProdutores.length > 0
                            }
                            onCheckedChange={handleSelectAllProdutores}
                          />
                          <label
                            htmlFor="select-all-produtores"
                            className="text-sm font-medium cursor-pointer"
                          >
                            Selecionar todos ({availableProdutores.length})
                          </label>
                        </div>
                        <Button
                          onClick={handleAddProdutores}
                          disabled={
                            selectedProdutores.length === 0 || addingProdutor
                          }
                          size="sm"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar ({selectedProdutores.length})
                        </Button>
                      </div>
                      <ScrollArea className="h-[200px] border rounded-md p-2">
                        <div className="space-y-2">
                          {availableProdutores.map((produtor) => (
                            <div
                              key={produtor.id}
                              className="flex items-center gap-2"
                            >
                              <Checkbox
                                id={`produtor-${produtor.id}`}
                                checked={selectedProdutores.includes(
                                  produtor.numerocm
                                )}
                                onCheckedChange={() =>
                                  handleToggleProdutor(produtor.numerocm)
                                }
                              />
                              <label
                                htmlFor={`produtor-${produtor.id}`}
                                className="text-sm cursor-pointer flex-1"
                              >
                                {produtor.nome}
                              </label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {gestorProdutores.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produtor</TableHead>
                          <TableHead className="w-[100px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {gestorProdutores.map((gp) => {
                          const produtor = produtores?.find(
                            (p) => p.numerocm === gp.produtor_numerocm
                          );
                          return (
                            <TableRow key={gp.id}>
                              <TableCell>
                                {produtor?.nome || gp.produtor_numerocm}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeProdutor(gp.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Nenhum produtor associado
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    Fazendas Associadas
                  </h3>
                  
                  {availableFazendas.length > 0 && (
                    <div className="mb-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="select-all-fazendas"
                            checked={
                              selectedFazendas.length ===
                                availableFazendas.length &&
                              availableFazendas.length > 0
                            }
                            onCheckedChange={handleSelectAllFazendas}
                          />
                          <label
                            htmlFor="select-all-fazendas"
                            className="text-sm font-medium cursor-pointer"
                          >
                            Selecionar todas ({availableFazendas.length})
                          </label>
                        </div>
                        <Button
                          onClick={handleAddFazendas}
                          disabled={
                            selectedFazendas.length === 0 || addingFazenda
                          }
                          size="sm"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar ({selectedFazendas.length})
                        </Button>
                      </div>
                      <ScrollArea className="h-[200px] border rounded-md p-2">
                        <div className="space-y-2">
                          {availableFazendas.map((fazenda) => (
                            <div
                              key={fazenda.id}
                              className="flex items-center gap-2"
                            >
                              <Checkbox
                                id={`fazenda-${fazenda.id}`}
                                checked={selectedFazendas.includes(fazenda.id)}
                                onCheckedChange={() =>
                                  handleToggleFazenda(fazenda.id)
                                }
                              />
                              <label
                                htmlFor={`fazenda-${fazenda.id}`}
                                className="text-sm cursor-pointer flex-1"
                              >
                                {fazenda.nomefazenda}
                              </label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {gestorFazendas.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fazenda</TableHead>
                          <TableHead className="w-[100px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {gestorFazendas.map((gf) => {
                          const fazenda = fazendas?.find(
                            (f) => f.id === gf.fazenda_id
                          );
                          return (
                            <TableRow key={gf.id}>
                              <TableCell>
                                {fazenda?.nomefazenda || gf.fazenda_id}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeFazenda(gf.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Nenhuma fazenda associada
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
