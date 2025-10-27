import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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

export const ImportCultivares = () => {
  const [isImporting, setIsImporting] = useState(false);
  const [totalRows, setTotalRows] = useState(0);
  const [importedRows, setImportedRows] = useState(0);
  const [showSummary, setShowSummary] = useState(false);

  const parseExcelDate = (value: any): string | null => {
    if (!value) return null;
    
    // Se for um número (data do Excel)
    if (typeof value === 'number') {
      const date = new Date((value - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }
    
    // Se for string em formato DD/MM/YYYY
    if (typeof value === 'string' && value.includes('/')) {
      const [day, month, year] = value.split('/');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
    
    return null;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportedRows(0);
    setShowSummary(false);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      setTotalRows(jsonData.length);

      for (const row of jsonData as any[]) {
        const cultivarData = {
          numero_registro: row["Nº REGISTRO"] || row["N° REGISTRO"],
          cultivar: row["CULTIVAR"] || null,
          nome_comum: row["NOME COMUM"] || null,
          nome_cientifico: row["NOME CIENTÍFICO"] || null,
          grupo_especie: row["GRUPO DA ESPÉCIE"] || null,
          situacao: row["SITUAÇÃO"] || null,
          numero_formulario: row["Nº FORMULÁRIO"] || row["N° FORMULÁRIO"] || null,
          data_registro: parseExcelDate(row["DATA DO REGISTRO"]),
          data_validade_registro: parseExcelDate(row["DATA DE VALIDADE DO REGISTRO"]),
          mantenedor: row["MANTENEDOR, (REQUERENTE) (NOME)"] || row["MANTENEDOR"] || null,
        };

        const { error } = await supabase
          .from("cultivares_catalog")
          .upsert(cultivarData, { 
            onConflict: "numero_registro",
            ignoreDuplicates: false 
          });

        if (error) {
          console.error("Erro ao importar cultivar:", error);
        } else {
          setImportedRows((prev) => prev + 1);
        }
      }
      toast.success(`Importação concluída! ${importedRows} de ${totalRows} processadas`);
      setShowSummary(true);
    } catch (error) {
      console.error("Erro ao processar arquivo:", error);
      toast.error("Erro ao processar arquivo. Verifique o formato.");
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar Cultivares</CardTitle>
        <CardDescription>
          Faça upload de uma planilha Excel (.xlsx ou .xls) com as colunas: CULTIVAR, NOME COMUM, NOME CIENTÍFICO, 
          GRUPO DA ESPÉCIE, SITUAÇÃO, Nº FORMULÁRIO, Nº REGISTRO, DATA DO REGISTRO, DATA DE VALIDADE DO REGISTRO, MANTENEDOR
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="cultivares-file">Selecione o arquivo</Label>
          <div className="flex items-center gap-4">
            <Input
              id="cultivares-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              disabled={isImporting}
            />
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
