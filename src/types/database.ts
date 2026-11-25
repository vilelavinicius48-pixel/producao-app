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
  barra_comprimento_mm: number | null;
  barra_sobra_mm: number;
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
  tempo_padrao_segundos: number | null;
  ativo: boolean;
  created_at: string;
  material_id: string | null;
  comprimento_consumido_mm: number | null;
  pecas_por_folha: number | null;
  desenho_path: string | null;
  desenho_content_type: string | null;
};

/** Tipo da etapa: manual = posto físico; maquina = gera OP de 2ª operação; externo = tratamento
 *  com fornecedor; inspecao = usa o módulo de qualidade já existente. */
export type TipoEtapa = "manual" | "maquina" | "externo" | "inspecao";

export type Etapa = {
  id: string;
  nome: string;
  tipo: TipoEtapa;
  ativo: boolean;
  created_at: string;
};

export type Tratamento = {
  id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
};

export type Fornecedor = {
  id: string;
  nome: string;
  contato: string | null;
  ativo: boolean;
  created_at: string;
};

export type MotivoRefugo = {
  id: string;
  descricao: string;
  ativo: boolean;
  created_at: string;
};

export type PecaRoteiroEtapa = {
  id: string;
  peca_id: string;
  etapa_id: string;
  ordem: number;
  maquina_id: string | null;
  tratamento_id: string | null;
  created_at: string;
};

export type PecaPlanoMedicaoCota = {
  id: string;
  peca_id: string;
  ordem: number;
  tipo: string;
  eh_atributo: boolean;
  nominal: number | null;
  minimo: number | null;
  maximo: number | null;
  instrumento: string | null;
  frequencia: string | null;
  created_at: string;
};

/** Formato do material: decide o que medida_a/medida_b/espessura significam. Ver lib/pcp/material.ts. */
export type FormatoMaterial = "redonda" | "sextavada" | "quadrada" | "retangular" | "tubo" | "chapa";

export type Material = {
  id: string;
  formato: FormatoMaterial;
  tipo: string;
  medida_a_mm: number;
  medida_b_mm: number | null;
  espessura_mm: number | null;
  ativo: boolean;
  created_at: string;
};

export type EstoqueMaterialMovimento = {
  id: string;
  material_id: string;
  tipo: "entrada" | "saida" | "ajuste";
  quantidade: number;
  observacao: string | null;
  criado_por: string | null;
  created_at: string;
};

export type EstoqueMaterial = {
  material_id: string;
  saldo: number;
  atualizado_em: string;
};

export type PedidoCompraMaterial = {
  id: string;
  material_id: string;
  quantidade: number;
  quantidade_recebida: number | null;
  fornecedor: string;
  data_pedido: string;
  previsao_chegada: string | null;
  status: "pedido" | "recebido" | "cancelado";
  recebido_em: string | null;
  criado_por: string | null;
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

export type StatusOP = "planejada" | "aberta" | "setup" | "em_producao" | "parada" | "concluida";

/** Situação de cada item de preparação da OP (material, ferramenta, dispositivo, programa). */
export type StatusPreparo = "pendente" | "aguardando" | "ok" | "na";

export type OrdemProducao = {
  id: string;
  numero: number;
  peca_id: string;
  maquina_id: string;
  quantidade_planejada: number;
  tempo_estimado_segundos: number | null;
  status: StatusOP;
  criado_por: string | null;
  created_at: string;
  concluida_em: string | null;
  setup_concluido_em: string | null;
  pedido_item_id: string | null;
  sequencia: number | null;
  material_status: StatusPreparo;
  ferramenta_status: StatusPreparo;
  dispositivo_status: StatusPreparo;
  programa_status: StatusPreparo;
  previsao_material: string | null;
  obs_pcp: string | null;
  liberada_em: string | null;
  material_id: string | null;
  material_barras_necessarias: number | null;
  material_folhas_necessarias: number | null;
  material_metros_necessarios: number | null;
  material_status_manual: boolean;
};

export type PedidoItem = {
  id: string;
  chave: string;
  cliente: string;
  numero_pedido: string;
  pedido_compra: string | null;
  data_pedido: string | null;
  data_entrega: string;
  codigo_produto: string;
  descricao: string;
  quantidade: number;
  peca_id: string | null;
  empresa: string | null;
  status: "aberto" | "encerrado";
  encerrado_em: string | null;
  created_at: string;
  updated_at: string;
};

export type ImportacaoPedidos = {
  id: string;
  arquivo: string | null;
  linhas: number;
  novos: number;
  alterados: number;
  encerrados: number;
  reabertos: number;
  criado_por: string | null;
  created_at: string;
};

export type EstoqueMovimento = {
  id: string;
  peca_id: string;
  tipo: "entrada" | "saida" | "ajuste";
  quantidade: number;
  observacao: string | null;
  criado_por: string | null;
  created_at: string;
};

export type EstoquePeca = {
  peca_id: string;
  saldo: number;
  atualizado_em: string;
};

export type Setup = {
  id: string;
  op_id: string;
  operador_id: string;
  timestamp_inicio: string;
  timestamp_fim: string | null;
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
      etapas: {
        Row: Etapa;
        Insert: Partial<Etapa> & Pick<Etapa, "nome" | "tipo">;
        Update: Partial<Etapa>;
        Relationships: [];
      };
      tratamentos: {
        Row: Tratamento;
        Insert: Partial<Tratamento> & Pick<Tratamento, "nome">;
        Update: Partial<Tratamento>;
        Relationships: [];
      };
      fornecedores: {
        Row: Fornecedor;
        Insert: Partial<Fornecedor> & Pick<Fornecedor, "nome">;
        Update: Partial<Fornecedor>;
        Relationships: [];
      };
      motivos_refugo: {
        Row: MotivoRefugo;
        Insert: Partial<MotivoRefugo> & Pick<MotivoRefugo, "descricao">;
        Update: Partial<MotivoRefugo>;
        Relationships: [];
      };
      peca_roteiro_etapas: {
        Row: PecaRoteiroEtapa;
        Insert: Partial<PecaRoteiroEtapa> & Pick<PecaRoteiroEtapa, "peca_id" | "etapa_id" | "ordem">;
        Update: Partial<PecaRoteiroEtapa>;
        Relationships: [
          {
            foreignKeyName: "peca_roteiro_etapas_peca_id_fkey";
            columns: ["peca_id"];
            isOneToOne: false;
            referencedRelation: "pecas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "peca_roteiro_etapas_etapa_id_fkey";
            columns: ["etapa_id"];
            isOneToOne: false;
            referencedRelation: "etapas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "peca_roteiro_etapas_maquina_id_fkey";
            columns: ["maquina_id"];
            isOneToOne: false;
            referencedRelation: "maquinas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "peca_roteiro_etapas_tratamento_id_fkey";
            columns: ["tratamento_id"];
            isOneToOne: false;
            referencedRelation: "tratamentos";
            referencedColumns: ["id"];
          },
        ];
      };
      peca_plano_medicao_cotas: {
        Row: PecaPlanoMedicaoCota;
        Insert: Partial<PecaPlanoMedicaoCota> & Pick<PecaPlanoMedicaoCota, "peca_id" | "ordem" | "tipo">;
        Update: Partial<PecaPlanoMedicaoCota>;
        Relationships: [
          {
            foreignKeyName: "peca_plano_medicao_cotas_peca_id_fkey";
            columns: ["peca_id"];
            isOneToOne: false;
            referencedRelation: "pecas";
            referencedColumns: ["id"];
          },
        ];
      };
      pecas: {
        Row: Peca;
        Insert: Partial<Peca> & Pick<Peca, "codigo" | "descricao">;
        Update: Partial<Peca>;
        Relationships: [
          {
            foreignKeyName: "pecas_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "materiais";
            referencedColumns: ["id"];
          },
        ];
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
          Pick<OrdemProducao, "peca_id" | "maquina_id" | "quantidade_planejada">;
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
          {
            foreignKeyName: "ordens_producao_pedido_item_id_fkey";
            columns: ["pedido_item_id"];
            isOneToOne: false;
            referencedRelation: "pedido_itens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ordens_producao_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "materiais";
            referencedColumns: ["id"];
          },
        ];
      };
      pedido_itens: {
        Row: PedidoItem;
        Insert: Partial<PedidoItem> &
          Pick<PedidoItem, "chave" | "cliente" | "numero_pedido" | "data_entrega" | "codigo_produto" | "descricao" | "quantidade">;
        Update: Partial<PedidoItem>;
        Relationships: [
          {
            foreignKeyName: "pedido_itens_peca_id_fkey";
            columns: ["peca_id"];
            isOneToOne: false;
            referencedRelation: "pecas";
            referencedColumns: ["id"];
          },
        ];
      };
      importacoes_pedidos: {
        Row: ImportacaoPedidos;
        Insert: Partial<ImportacaoPedidos>;
        Update: Partial<ImportacaoPedidos>;
        Relationships: [];
      };
      estoque_movimentos: {
        Row: EstoqueMovimento;
        Insert: Partial<EstoqueMovimento> & Pick<EstoqueMovimento, "peca_id" | "tipo" | "quantidade">;
        Update: Partial<EstoqueMovimento>;
        Relationships: [
          {
            foreignKeyName: "estoque_movimentos_peca_id_fkey";
            columns: ["peca_id"];
            isOneToOne: false;
            referencedRelation: "pecas";
            referencedColumns: ["id"];
          },
        ];
      };
      materiais: {
        Row: Material;
        Insert: Partial<Material> & Pick<Material, "formato" | "tipo" | "medida_a_mm">;
        Update: Partial<Material>;
        Relationships: [];
      };
      estoque_material_movimentos: {
        Row: EstoqueMaterialMovimento;
        Insert: Partial<EstoqueMaterialMovimento> &
          Pick<EstoqueMaterialMovimento, "material_id" | "tipo" | "quantidade">;
        Update: Partial<EstoqueMaterialMovimento>;
        Relationships: [
          {
            foreignKeyName: "estoque_material_movimentos_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "materiais";
            referencedColumns: ["id"];
          },
        ];
      };
      pedidos_compra_material: {
        Row: PedidoCompraMaterial;
        Insert: Partial<PedidoCompraMaterial> & Pick<PedidoCompraMaterial, "material_id" | "quantidade" | "fornecedor">;
        Update: Partial<PedidoCompraMaterial>;
        Relationships: [
          {
            foreignKeyName: "pedidos_compra_material_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "materiais";
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
      setups: {
        Row: Setup;
        Insert: Partial<Setup> & Pick<Setup, "op_id" | "operador_id">;
        Update: Partial<Setup>;
        Relationships: [
          {
            foreignKeyName: "setups_op_id_fkey";
            columns: ["op_id"];
            isOneToOne: false;
            referencedRelation: "ordens_producao";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "setups_operador_id_fkey";
            columns: ["operador_id"];
            isOneToOne: false;
            referencedRelation: "operadores";
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
      estoque_pecas: {
        Row: EstoquePeca;
        Relationships: [];
      };
      estoque_materiais: {
        Row: EstoqueMaterial;
        Relationships: [];
      };
    };
    Functions: {
      iniciar_setup: {
        Args: { p_op_id: string; p_operador_id: string };
        Returns: Setup;
      };
      finalizar_setup: {
        Args: { p_setup_id: string };
        Returns: Apontamento;
      };
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
