export type Perfil = "gestor" | "operador" | "qualidade";

export type Operador = {
  id: string;
  matricula: string;
  nome: string;
  perfil: Perfil;
  ativo: boolean;
  created_at: string;
};

export type Maquina = {
  id: string;
  codigo: string;
  nome: string;
  ativo: boolean;
  created_at: string;
};

export type MotivoParada = {
  id: string;
  descricao: string;
  ativo: boolean;
  created_at: string;
};

export type Peca = {
  id: string;
  codigo: string;
  descricao: string;
  tempo_padrao_segundos: number;
  ativo: boolean;
  created_at: string;
};

export type PecaMaquina = {
  peca_id: string;
  maquina_id: string;
};

export type PecaMaterial = {
  id: string;
  peca_id: string;
  material: string;
  quantidade_por_unidade: number;
  unidade_medida: string;
};

export type StatusOP = "aberta" | "em_producao" | "parada" | "concluida";

export type OrdemProducao = {
  id: string;
  numero: number;
  peca_id: string;
  maquina_id: string;
  quantidade_planejada: number;
  tempo_estimado_segundos: number;
  status: StatusOP;
  criado_por: string | null;
  created_at: string;
  concluida_em: string | null;
};

export type Apontamento = {
  id: string;
  op_id: string;
  operador_id: string;
  timestamp_start: string;
  timestamp_stop: string | null;
  quantidade_produzida: number | null;
  quantidade_refugada: number | null;
  eficiencia: number | null;
};

export type Parada = {
  id: string;
  op_id: string;
  timestamp_inicio: string;
  timestamp_fim: string | null;
  motivo_id: string | null;
};

export type InspecaoQualidade = {
  id: string;
  apontamento_id: string;
  quantidade_aprovada: number;
  quantidade_reprovada: number;
  quantidade_retrabalho: number;
  observacao: string | null;
  avaliador_id: string;
  created_at: string;
};

export type OpProgresso = {
  op_id: string;
  quantidade_produzida_total: number;
  quantidade_refugada_total: number;
};

export type Database = {
  public: {
    Tables: {
      operadores: {
        Row: Operador;
        Insert: Partial<Operador> & Pick<Operador, "id" | "matricula" | "nome" | "perfil">;
        Update: Partial<Operador>;
        Relationships: [];
      };
      maquinas: {
        Row: Maquina;
        Insert: Partial<Maquina> & Pick<Maquina, "codigo" | "nome">;
        Update: Partial<Maquina>;
        Relationships: [];
      };
      motivos_parada: {
        Row: MotivoParada;
        Insert: Partial<MotivoParada> & Pick<MotivoParada, "descricao">;
        Update: Partial<MotivoParada>;
        Relationships: [];
      };
      pecas: {
        Row: Peca;
        Insert: Partial<Peca> & Pick<Peca, "codigo" | "descricao" | "tempo_padrao_segundos">;
        Update: Partial<Peca>;
        Relationships: [];
      };
      pecas_maquinas: {
        Row: PecaMaquina;
        Insert: PecaMaquina;
        Update: Partial<PecaMaquina>;
        Relationships: [
          {
            foreignKeyName: "pecas_maquinas_maquina_id_fkey";
            columns: ["maquina_id"];
            isOneToOne: false;
            referencedRelation: "maquinas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pecas_maquinas_peca_id_fkey";
            columns: ["peca_id"];
            isOneToOne: false;
            referencedRelation: "pecas";
            referencedColumns: ["id"];
          },
        ];
      };
      peca_materiais: {
        Row: PecaMaterial;
        Insert: Partial<PecaMaterial> &
          Pick<PecaMaterial, "peca_id" | "material" | "quantidade_por_unidade">;
        Update: Partial<PecaMaterial>;
        Relationships: [
          {
            foreignKeyName: "peca_materiais_peca_id_fkey";
            columns: ["peca_id"];
            isOneToOne: false;
            referencedRelation: "pecas";
            referencedColumns: ["id"];
          },
        ];
      };
      ordens_producao: {
        Row: OrdemProducao;
        Insert: Partial<OrdemProducao> &
          Pick<OrdemProducao, "peca_id" | "maquina_id" | "quantidade_planejada" | "tempo_estimado_segundos">;
        Update: Partial<OrdemProducao>;
        Relationships: [
          {
            foreignKeyName: "ordens_producao_peca_id_fkey";
            columns: ["peca_id"];
            isOneToOne: false;
            referencedRelation: "pecas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ordens_producao_maquina_id_fkey";
            columns: ["maquina_id"];
            isOneToOne: false;
            referencedRelation: "maquinas";
            referencedColumns: ["id"];
          },
        ];
      };
      apontamentos: {
        Row: Apontamento;
        Insert: Partial<Apontamento> & Pick<Apontamento, "op_id" | "operador_id">;
        Update: Partial<Apontamento>;
        Relationships: [
          {
            foreignKeyName: "apontamentos_op_id_fkey";
            columns: ["op_id"];
            isOneToOne: false;
            referencedRelation: "ordens_producao";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "apontamentos_operador_id_fkey";
            columns: ["operador_id"];
            isOneToOne: false;
            referencedRelation: "operadores";
            referencedColumns: ["id"];
          },
        ];
      };
      paradas: {
        Row: Parada;
        Insert: Partial<Parada> & Pick<Parada, "op_id">;
        Update: Partial<Parada>;
        Relationships: [
          {
            foreignKeyName: "paradas_op_id_fkey";
            columns: ["op_id"];
            isOneToOne: false;
            referencedRelation: "ordens_producao";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "paradas_motivo_id_fkey";
            columns: ["motivo_id"];
            isOneToOne: false;
            referencedRelation: "motivos_parada";
            referencedColumns: ["id"];
          },
        ];
      };
      inspecoes_qualidade: {
        Row: InspecaoQualidade;
        Insert: Partial<InspecaoQualidade> & Pick<InspecaoQualidade, "apontamento_id" | "avaliador_id">;
        Update: Partial<InspecaoQualidade>;
        Relationships: [
          {
            foreignKeyName: "inspecoes_qualidade_apontamento_id_fkey";
            columns: ["apontamento_id"];
            isOneToOne: true;
            referencedRelation: "apontamentos";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      op_progresso: {
        Row: OpProgresso;
        Relationships: [];
      };
    };
    Functions: {
      iniciar_apontamento: {
        Args: { p_op_id: string; p_operador_id: string };
        Returns: Apontamento;
      };
      parar_producao: {
        Args: {
          p_apontamento_id: string;
          p_quantidade_produzida: number;
          p_quantidade_refugada: number;
        };
        Returns: Apontamento;
      };
      pausar_producao: {
        Args: {
          p_apontamento_id: string;
          p_quantidade_produzida: number;
          p_quantidade_refugada: number;
        };
        Returns: Apontamento;
      };
      voltar_parada: {
        Args: { p_op_id: string; p_motivo_id: string; p_operador_id: string };
        Returns: Apontamento;
      };
    };
  };
}
