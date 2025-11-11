export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      aplicacoes_defensivos: {
        Row: {
          area: string
          created_at: string | null
          id: string
          produtor_numerocm: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          area: string
          created_at?: string | null
          id?: string
          produtor_numerocm?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          area?: string
          created_at?: string | null
          id?: string
          produtor_numerocm?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      calendario_aplicacoes: {
        Row: {
          cod_aplic: string
          cod_aplic_ger: string | null
          cod_classe: string
          created_at: string | null
          descr_aplicacao: string
          descricao_classe: string
          id: string
          trat_sementes: string | null
          updated_at: string | null
        }
        Insert: {
          cod_aplic: string
          cod_aplic_ger?: string | null
          cod_classe: string
          created_at?: string | null
          descr_aplicacao: string
          descricao_classe: string
          id?: string
          trat_sementes?: string | null
          updated_at?: string | null
        }
        Update: {
          cod_aplic?: string
          cod_aplic_ger?: string | null
          cod_classe?: string
          created_at?: string | null
          descr_aplicacao?: string
          descricao_classe?: string
          id?: string
          trat_sementes?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      consultores: {
        Row: {
          consultor: string
          created_at: string | null
          email: string
          id: string
          numerocm_consultor: string
          updated_at: string | null
        }
        Insert: {
          consultor: string
          created_at?: string | null
          email: string
          id?: string
          numerocm_consultor: string
          updated_at?: string | null
        }
        Update: {
          consultor?: string
          created_at?: string | null
          email?: string
          id?: string
          numerocm_consultor?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      cultivares_catalog: {
        Row: {
          cod_item: string
          created_at: string | null
          cultivar: string | null
          cultura: string | null
          grupo: string | null
          id: string
          item: string | null
          marca: string | null
          updated_at: string | null
        }
        Insert: {
          cod_item: string
          created_at?: string | null
          cultivar?: string | null
          cultura?: string | null
          grupo?: string | null
          id?: string
          item?: string | null
          marca?: string | null
          updated_at?: string | null
        }
        Update: {
          cod_item?: string
          created_at?: string | null
          cultivar?: string | null
          cultura?: string | null
          grupo?: string | null
          id?: string
          item?: string | null
          marca?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      defensivos_catalog: {
        Row: {
          cod_item: string
          created_at: string | null
          grupo: string | null
          id: string
          item: string | null
          marca: string | null
          principio_ativo: string | null
          updated_at: string | null
        }
        Insert: {
          cod_item: string
          created_at?: string | null
          grupo?: string | null
          id?: string
          item?: string | null
          marca?: string | null
          principio_ativo?: string | null
          updated_at?: string | null
        }
        Update: {
          cod_item?: string
          created_at?: string | null
          grupo?: string | null
          id?: string
          item?: string | null
          marca?: string | null
          principio_ativo?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fazendas: {
        Row: {
          area_cultivavel: number | null
          created_at: string | null
          id: string
          idfazenda: string
          nomefazenda: string
          numerocm: string
          numerocm_consultor: string
          updated_at: string | null
        }
        Insert: {
          area_cultivavel?: number | null
          created_at?: string | null
          id?: string
          idfazenda: string
          nomefazenda: string
          numerocm: string
          numerocm_consultor: string
          updated_at?: string | null
        }
        Update: {
          area_cultivavel?: number | null
          created_at?: string | null
          id?: string
          idfazenda?: string
          nomefazenda?: string
          numerocm?: string
          numerocm_consultor?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      fertilizantes_catalog: {
        Row: {
          cod_item: string
          created_at: string | null
          grupo: string | null
          id: string
          item: string | null
          marca: string | null
          principio_ativo: string | null
          updated_at: string | null
        }
        Insert: {
          cod_item: string
          created_at?: string | null
          grupo?: string | null
          id?: string
          item?: string | null
          marca?: string | null
          principio_ativo?: string | null
          updated_at?: string | null
        }
        Update: {
          cod_item?: string
          created_at?: string | null
          grupo?: string | null
          id?: string
          item?: string | null
          marca?: string | null
          principio_ativo?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      import_history: {
        Row: {
          arquivo_nome: string | null
          created_at: string
          id: string
          limpar_antes: boolean
          registros_deletados: number
          registros_importados: number
          tabela_nome: string
          user_id: string
        }
        Insert: {
          arquivo_nome?: string | null
          created_at?: string
          id?: string
          limpar_antes?: boolean
          registros_deletados?: number
          registros_importados?: number
          tabela_nome: string
          user_id: string
        }
        Update: {
          arquivo_nome?: string | null
          created_at?: string
          id?: string
          limpar_antes?: boolean
          registros_deletados?: number
          registros_importados?: number
          tabela_nome?: string
          user_id?: string
        }
        Relationships: []
      }
      justificativas_adubacao: {
        Row: {
          ativo: boolean
          created_at: string | null
          descricao: string
          id: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string | null
          descricao: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string | null
          descricao?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      produtores: {
        Row: {
          consultor: string | null
          created_at: string | null
          id: string
          nome: string
          numerocm: string
          numerocm_consultor: string
          updated_at: string | null
        }
        Insert: {
          consultor?: string | null
          created_at?: string | null
          id?: string
          nome: string
          numerocm: string
          numerocm_consultor: string
          updated_at?: string | null
        }
        Update: {
          consultor?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          numerocm?: string
          numerocm_consultor?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          id: string
          nome: string | null
          numerocm_consultor: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome?: string | null
          numerocm_consultor?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string | null
          numerocm_consultor?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      programacao_adubacao: {
        Row: {
          area: string
          created_at: string | null
          data_aplicacao: string | null
          deve_faturar: boolean | null
          dose: number
          fertilizante_salvo: boolean | null
          formulacao: string
          id: string
          justificativa_nao_adubacao_id: string | null
          percentual_cobertura: number | null
          porcentagem_salva: number | null
          produtor_numerocm: string | null
          programacao_id: string | null
          responsavel: string | null
          safra_id: string | null
          total: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          area: string
          created_at?: string | null
          data_aplicacao?: string | null
          deve_faturar?: boolean | null
          dose: number
          fertilizante_salvo?: boolean | null
          formulacao: string
          id?: string
          justificativa_nao_adubacao_id?: string | null
          percentual_cobertura?: number | null
          porcentagem_salva?: number | null
          produtor_numerocm?: string | null
          programacao_id?: string | null
          responsavel?: string | null
          safra_id?: string | null
          total?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          area?: string
          created_at?: string | null
          data_aplicacao?: string | null
          deve_faturar?: boolean | null
          dose?: number
          fertilizante_salvo?: boolean | null
          formulacao?: string
          id?: string
          justificativa_nao_adubacao_id?: string | null
          percentual_cobertura?: number | null
          porcentagem_salva?: number | null
          produtor_numerocm?: string | null
          programacao_id?: string | null
          responsavel?: string | null
          safra_id?: string | null
          total?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "programacao_adubacao_justificativa_nao_adubacao_id_fkey"
            columns: ["justificativa_nao_adubacao_id"]
            isOneToOne: false
            referencedRelation: "justificativas_adubacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programacao_adubacao_programacao_id_fkey"
            columns: ["programacao_id"]
            isOneToOne: false
            referencedRelation: "programacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programacao_adubacao_safra_id_fkey"
            columns: ["safra_id"]
            isOneToOne: false
            referencedRelation: "safras"
            referencedColumns: ["id"]
          },
        ]
      }
      programacao_cultivares: {
        Row: {
          area: string
          area_hectares: number | null
          created_at: string | null
          cultivar: string
          data_plantio: string | null
          id: string
          percentual_cobertura: number | null
          populacao_recomendada: number | null
          porcentagem_salva: number | null
          produtor_numerocm: string | null
          programacao_id: string | null
          quantidade: number
          referencia_rnc_mapa: string | null
          safra: string | null
          semente_propria: boolean | null
          sementes_por_saca: number | null
          tipo_embalagem: string | null
          tipo_tratamento: string | null
          tratamento_id: string | null
          unidade: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          area: string
          area_hectares?: number | null
          created_at?: string | null
          cultivar: string
          data_plantio?: string | null
          id?: string
          percentual_cobertura?: number | null
          populacao_recomendada?: number | null
          porcentagem_salva?: number | null
          produtor_numerocm?: string | null
          programacao_id?: string | null
          quantidade: number
          referencia_rnc_mapa?: string | null
          safra?: string | null
          semente_propria?: boolean | null
          sementes_por_saca?: number | null
          tipo_embalagem?: string | null
          tipo_tratamento?: string | null
          tratamento_id?: string | null
          unidade?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          area?: string
          area_hectares?: number | null
          created_at?: string | null
          cultivar?: string
          data_plantio?: string | null
          id?: string
          percentual_cobertura?: number | null
          populacao_recomendada?: number | null
          porcentagem_salva?: number | null
          produtor_numerocm?: string | null
          programacao_id?: string | null
          quantidade?: number
          referencia_rnc_mapa?: string | null
          safra?: string | null
          semente_propria?: boolean | null
          sementes_por_saca?: number | null
          tipo_embalagem?: string | null
          tipo_tratamento?: string | null
          tratamento_id?: string | null
          unidade?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "programacao_cultivares_programacao_id_fkey"
            columns: ["programacao_id"]
            isOneToOne: false
            referencedRelation: "programacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programacao_cultivares_tratamento_id_fkey"
            columns: ["tratamento_id"]
            isOneToOne: false
            referencedRelation: "tratamentos_sementes"
            referencedColumns: ["id"]
          },
        ]
      }
      programacao_cultivares_tratamentos: {
        Row: {
          created_at: string | null
          id: string
          programacao_cultivar_id: string
          tratamento_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          programacao_cultivar_id: string
          tratamento_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          programacao_cultivar_id?: string
          tratamento_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "programacao_cultivares_tratamentos_programacao_cultivar_id_fkey"
            columns: ["programacao_cultivar_id"]
            isOneToOne: false
            referencedRelation: "programacao_cultivares"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programacao_cultivares_tratamentos_tratamento_id_fkey"
            columns: ["tratamento_id"]
            isOneToOne: false
            referencedRelation: "tratamentos_sementes"
            referencedColumns: ["id"]
          },
        ]
      }
      programacao_defensivos: {
        Row: {
          alvo: string | null
          aplicacao_id: string | null
          area_hectares: number | null
          created_at: string | null
          defensivo: string
          deve_faturar: boolean | null
          dose: number
          id: string
          porcentagem_salva: number | null
          produto_salvo: boolean | null
          safra_id: string | null
          unidade: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          alvo?: string | null
          aplicacao_id?: string | null
          area_hectares?: number | null
          created_at?: string | null
          defensivo: string
          deve_faturar?: boolean | null
          dose: number
          id?: string
          porcentagem_salva?: number | null
          produto_salvo?: boolean | null
          safra_id?: string | null
          unidade?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          alvo?: string | null
          aplicacao_id?: string | null
          area_hectares?: number | null
          created_at?: string | null
          defensivo?: string
          deve_faturar?: boolean | null
          dose?: number
          id?: string
          porcentagem_salva?: number | null
          produto_salvo?: boolean | null
          safra_id?: string | null
          unidade?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "programacao_defensivos_aplicacao_id_fkey"
            columns: ["aplicacao_id"]
            isOneToOne: false
            referencedRelation: "aplicacoes_defensivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programacao_defensivos_safra_id_fkey"
            columns: ["safra_id"]
            isOneToOne: false
            referencedRelation: "programacao_defensivos"
            referencedColumns: ["id"]
          },
        ]
      }
      programacoes: {
        Row: {
          area: string
          area_hectares: number
          created_at: string
          fazenda_idfazenda: string
          id: string
          produtor_numerocm: string
          safra_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          area: string
          area_hectares: number
          created_at?: string
          fazenda_idfazenda: string
          id?: string
          produtor_numerocm: string
          safra_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          area?: string
          area_hectares?: number
          created_at?: string
          fazenda_idfazenda?: string
          id?: string
          produtor_numerocm?: string
          safra_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      safras: {
        Row: {
          ano_fim: number | null
          ano_inicio: number | null
          ativa: boolean
          created_at: string
          id: string
          is_default: boolean
          nome: string
          updated_at: string
        }
        Insert: {
          ano_fim?: number | null
          ano_inicio?: number | null
          ativa?: boolean
          created_at?: string
          id?: string
          is_default?: boolean
          nome: string
          updated_at?: string
        }
        Update: {
          ano_fim?: number | null
          ano_inicio?: number | null
          ativa?: boolean
          created_at?: string
          id?: string
          is_default?: boolean
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      tratamentos_sementes: {
        Row: {
          ativo: boolean
          created_at: string | null
          cultura: string
          id: string
          nome: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string | null
          cultura: string
          id?: string
          nome: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string | null
          cultura?: string
          id?: string
          nome?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_consultor: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
