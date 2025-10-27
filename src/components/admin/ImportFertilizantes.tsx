import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Upload } from "lucide-react";
import * as XLSX from "xlsx";

export const ImportFertilizantes = () => {
  const [isImporting, setIsImporting] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      let inserted = 0;
      let updated = 0;

      for (const row of jsonData as any[]) {
        const fertilizanteData = {
          cod_item: row["COD. ITEM"] || row["COD ITEM"],
          item: row["ITEM"],
          grupo: row["GRUPO"],
          marca: row["MARCA"],
          principio_ativo: row["PRINCIPIO_ATIVO"] || row["PRINCIPIO ATIVO"],
        };

        const { error } = await supabase
          .from("fertilizantes_catalog")
          .upsert(fertilizanteData, { 
            onConflict: "cod_item",
            ignoreDuplicates: false 
          });

        if (error) {
          console.error("Erro ao importar fertilizante:", error);
        } else {
          const { data: existing } = await supabase
            .from("fertilizantes_catalog")
            .select("id")
            .eq("cod_item", fertilizanteData.cod_item)
            .single();
          
          if (existing) {
            updated++;
          } else {
            inserted++;
          }
        }
      }

      toast.success(`Importação concluída! ${inserted} inseridos, ${updated} atualizados`);
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
        <CardTitle>Importar Fertilizantes</CardTitle>
        <CardDescription>
          Faça upload de uma planilha Excel (.xlsx ou .xls) com as colunas: 
          COD. ITEM, ITEM, GRUPO, MARCA, PRINCIPIO_ATIVO
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fertilizantes-file">Selecione o arquivo</Label>
          <div className="flex items-center gap-4">
            <Input
              id="fertilizantes-file"
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
          <p className="text-sm text-muted-foreground">Importando dados...</p>
        )}
      </CardContent>
    </Card>
  );
};
