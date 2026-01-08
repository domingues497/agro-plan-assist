import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useProfile } from "@/hooks/useProfile";
import { Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useImportCalendarioMutation } from "@/hooks/useImportCalendarioMutation";

export const ImportCalendario = () => {
  const [totalRows, setTotalRows] = useState(0);
  const [importedRows, setImportedRows] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const { profile } = useProfile();
  
  const importMutation = useImportCalendarioMutation();
  const isImporting = importMutation.isPending;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportedRows(0);
    setShowSummary(false);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      setTotalRows(jsonData.length);
      const items = (jsonData as any[]).map((row) => ({
        cod_aplic: row["Cód. aplic."] ?? row["COD. APLIC"] ?? row["COD APLIC"] ?? null,
        descr_aplicacao: row["Descr. aplicação"] ?? row["DESCR. APLICAÇÃO"] ?? row["DESCR APLICACAO"] ?? null,
        cod_aplic_ger: row["Cód. aplic. ger."] ?? row["COD. APLIC. GER."] ?? row["COD APLIC GER"] ?? null,
        cod_classe: row["Cód. classe"] ?? row["COD. CLASSE"] ?? row["COD CLASSE"] ?? null,
        descricao_classe: row["Descrição classe"] ?? row["DESCRIÇÃO CLASSE"] ?? row["DESCRICAO CLASSE"] ?? null,
        trat_sementes: row["Trat. sementes"] ?? row["TRAT. SEMENTES"] ?? row["TRAT SEMENTES"] ?? null,
      }));

      importMutation.mutate({
        items,
        limparAntes: false,
        userId: profile?.id,
        fileName: file.name
      }, {
        onSuccess: (json) => {
          setImportedRows(Number(json?.imported || items.length));
          toast.success(`Importação concluída! ${Number(json?.imported || items.length)} de ${jsonData.length} processadas`);
          setShowSummary(true);
        },
        onError: (error) => {
          console.error("Erro ao processar arquivo:", error);
          toast.error("Erro ao processar arquivo. Verifique o formato.");
        }
      });
      
    } catch (error) {
      console.error("Erro ao processar arquivo:", error);
      toast.error("Erro ao processar arquivo. Verifique o formato.");
    } finally {
      e.target.value = "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendário</CardTitle>
        <CardDescription>
          Importe a planilha com as colunas: Cód. aplic., Descr. aplicação, Cód. aplic. ger., Cód. classe, Descrição classe, Trat. sementes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Arquivo XLSX</Label>
          <div className="flex items-center gap-4">
            <Input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} disabled={isImporting} />
            <Button disabled={isImporting} size="icon" variant="outline">
              <Upload className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isImporting && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Importando {importedRows} de {totalRows} linhas...
            </p>
            <Progress value={totalRows ? Math.round((importedRows / totalRows) * 100) : 0} />
          </div>
        )}
      </CardContent>

      <AlertDialog open={showSummary} onOpenChange={setShowSummary}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resumo da Importação</AlertDialogTitle>
            <AlertDialogDescription>
              Total na planilha: {totalRows}
              <br />
              Linhas importadas: {importedRows}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Fechar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
