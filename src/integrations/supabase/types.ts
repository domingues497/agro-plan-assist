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
          created_at: string | null
          cultivar: string | null
          data_registro: string | null
          data_validade_registro: string | null
          grupo_especie: string | null
          id: string
          mantenedor: string | null
          nome_cientifico: string | null
          nome_comum: string | null
          numero_formulario: string | null
          numero_registro: string
          situacao: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          cultivar?: string | null
          data_registro?: string | null
          data_validade_registro?: string | null
          grupo_especie?: string | null
          id?: string
          mantenedor?: string | null
          nome_cientifico?: string | null
          nome_comum?: string | null
          numero_formulario?: string | null
          numero_registro: string
          situacao?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          cultivar?: string | null
          data_registro?: string | null
          data_validade_registro?: string | null
          grupo_especie?: string | null
          id?: string
          mantenedor?: string | null
          nome_cientifico?: string | null
          nome_comum?: string | null
          numero_formulario?: string | null
          numero_registro?: string
          situacao?: string | null
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
          porcentagem_salva: number | null
          produtor_numerocm: string | null
          responsavel: string | null
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
          porcentagem_salva?: number | null
          produtor_numerocm?: string | null
          responsavel?: string | null
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
          porcentagem_salva?: number | null
          produtor_numerocm?: string | null
          responsavel?: string | null
          total?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      programacao_cultivares: {
        Row: {
          area: string
          created_at: string | null
          cultivar: string
          data_plantio: string | null
          id: string
          porcentagem_salva: number | null
          produtor_numerocm: string | null
          quantidade: number
          referencia_rnc_mapa: string | null
          safra: string | null
          semente_propria: boolean | null
          unidade: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          area: string
          created_at?: string | null
          cultivar: string
          data_plantio?: string | null
          id?: string
          porcentagem_salva?: number | null
          produtor_numerocm?: string | null
          quantidade: number
          referencia_rnc_mapa?: string | null
          safra?: string | null
          semente_propria?: boolean | null
          unidade?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          area?: string
          created_at?: string | null
          cultivar?: string
          data_plantio?: string | null
          id?: string
          porcentagem_salva?: number | null
          produtor_numerocm?: string | null
          quantidade?: number
          referencia_rnc_mapa?: string | null
          safra?: string | null
          semente_propria?: boolean | null
          unidade?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      programacao_defensivos: {
        Row: {
          alvo: string | null
          aplicacao_id: string | null
          created_at: string | null
          defensivo: string
          deve_faturar: boolean | null
          dose: number
          id: string
          porcentagem_salva: number | null
          produto_salvo: boolean | null
          unidade: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          alvo?: string | null
          aplicacao_id?: string | null
          created_at?: string | null
          defensivo: string
          deve_faturar?: boolean | null
          dose: number
          id?: string
          porcentagem_salva?: number | null
          produto_salvo?: boolean | null
          unidade?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          alvo?: string | null
          aplicacao_id?: string | null
          created_at?: string | null
          defensivo?: string
          deve_faturar?: boolean | null
          dose?: number
          id?: string
          porcentagem_salva?: number | null
          produto_salvo?: boolean | null
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
        ]
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
