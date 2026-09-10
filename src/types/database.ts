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
  tempo_padrao_por_unidade: number;
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
        Insert: Partial<Peca> & Pick<Peca, "codigo" | "descricao" | "tempo_padrao_por_unidade">;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
