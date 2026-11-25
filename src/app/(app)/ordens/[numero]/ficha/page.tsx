import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { getBaseUrl } from "@/lib/base-url";
import { formatData, formatQtd } from "@/lib/pcp/carteira";
import { TIPO_ETAPA_LABEL } from "@/lib/roteiro";
import { ImprimirButton } from "./ImprimirButton";
import type { TipoEtapa } from "@/types/database";

const COTAS_POR_PAGINA = 10;
const LINHAS_MEDICAO = 36;

type RoteiroItem = {
  ordem: number;
  etapa: { nome: string; tipo: TipoEtapa } | null;
  maquina: { nome: string } | null;
  tratamento: { nome: string } | null;
};

type Cota = {
  tipo: string;
  eh_atributo: boolean;
  nominal: number | null;
  minimo: number | null;
  maximo: number | null;
};

function numeroOuTraco(v: number | null): string {
  return v === null ? "-" : String(v);
}

export default async function FichaOPPage({ params }: { params: Promise<{ numero: string }> }) {
  const { numero } = await params;
  const supabase = await createClient();

  const { data: op } = await supabase
    .from("ordens_producao")
    .select("*, pecas(id, codigo, descricao, desenho_path, desenho_content_type), maquinas(nome), pedido_itens(cliente, data_entrega)")
    .eq("numero", Number(numero))
    .single();
  if (!op) notFound();

  const peca = op.pecas as unknown as {
    id: string;
    codigo: string;
    descricao: string;
    desenho_path: string | null;
    desenho_content_type: string | null;
  };
  const maquina = op.maquinas as unknown as { nome: string } | null;
  const pedido = op.pedido_itens as unknown as { cliente: string; data_entrega: string } | null;

  const [{ data: roteiro }, { data: cotas }] = await Promise.all([
    supabase
      .from("peca_roteiro_etapas")
      .select("ordem, etapa:etapas(nome, tipo), maquina:maquinas(nome), tratamento:tratamentos(nome)")
      .eq("peca_id", peca.id)
      .order("ordem")
      .overrideTypes<RoteiroItem[], { merge: false }>(),
    supabase
      .from("peca_plano_medicao_cotas")
      .select("tipo, eh_atributo, nominal, minimo, maximo")
      .eq("peca_id", peca.id)
      .order("ordem")
      .overrideTypes<Cota[], { merge: false }>(),
  ]);

  const baseUrl = await getBaseUrl();
  const qrDataUrl = await QRCode.toDataURL(`${baseUrl}/op/${op.numero}`, { margin: 1, width: 220 });

  const desenhoUrl = peca.desenho_path
    ? supabase.storage.from("desenhos").getPublicUrl(peca.desenho_path).data.publicUrl
    : null;
  const desenhoEhImagem = peca.desenho_content_type?.startsWith("image/");

  const paginasCotas: Cota[][] = [];
  for (let i = 0; i < (cotas ?? []).length; i += COTAS_POR_PAGINA) {
    paginasCotas.push((cotas ?? []).slice(i, i + COTAS_POR_PAGINA));
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-600">
          Ficha da OP {op.numero} — confira antes de imprimir (A4). O QR abre esta OP no celular.
        </p>
        <ImprimirButton />
      </div>

      {/* Página 1: cabeçalho + roteiro + QR */}
      <section className="ficha-pagina rounded-xl border border-slate-300 bg-white p-6 text-sm text-slate-900 print:border-0 print:rounded-none">
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-3">
          <div>
            <h1 className="text-2xl font-bold">RP VILELA USINAGENS</h1>
            <p className="text-lg font-semibold">Ficha da OP {op.numero}</p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL gerada no servidor, next/image não serve */}
          <img src={qrDataUrl} alt="QR code da OP" width={120} height={120} />
        </div>

        <table className="mt-4 w-full border-collapse text-sm">
          <tbody>
            <tr>
              <td className="w-32 border border-slate-400 bg-slate-50 px-2 py-1.5 font-semibold">Peça</td>
              <td className="border border-slate-400 px-2 py-1.5" colSpan={3}>
                {peca.codigo} — {peca.descricao}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-400 bg-slate-50 px-2 py-1.5 font-semibold">Cliente</td>
              <td className="border border-slate-400 px-2 py-1.5">{pedido?.cliente ?? "-"}</td>
              <td className="border border-slate-400 bg-slate-50 px-2 py-1.5 font-semibold">Entrega</td>
              <td className="border border-slate-400 px-2 py-1.5">{pedido ? formatData(pedido.data_entrega) : "-"}</td>
            </tr>
            <tr>
              <td className="border border-slate-400 bg-slate-50 px-2 py-1.5 font-semibold">Quantidade</td>
              <td className="border border-slate-400 px-2 py-1.5">{formatQtd(Number(op.quantidade_planejada))} pç</td>
              <td className="border border-slate-400 bg-slate-50 px-2 py-1.5 font-semibold">Máquina</td>
              <td className="border border-slate-400 px-2 py-1.5">{maquina?.nome ?? "-"}</td>
            </tr>
          </tbody>
        </table>

        <h2 className="mt-6 text-base font-semibold">Roteiro</h2>
        {roteiro && roteiro.length > 0 ? (
          <ol className="mt-2 space-y-1">
            {roteiro.map((r, i) => (
              <li key={i} className="flex items-center gap-2 border border-slate-300 px-2 py-1.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span className="font-medium">{r.etapa?.nome}</span>
                <span className="text-xs text-slate-500">({r.etapa && TIPO_ETAPA_LABEL[r.etapa.tipo]})</span>
                {r.maquina && <span className="text-xs text-slate-600">— máquina: {r.maquina.nome}</span>}
                {r.tratamento && <span className="text-xs text-slate-600">— tratamento: {r.tratamento.nome}</span>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-amber-700">Nenhum roteiro cadastrado para esta peça.</p>
        )}
      </section>

      {/* Página(s): Acompanhamento de medição */}
      {paginasCotas.length === 0 ? (
        <section className="ficha-pagina mt-6 rounded-xl border border-slate-300 bg-white p-6 text-sm print:border-0">
          <p className="text-amber-700">Nenhuma cota de medição cadastrada para esta peça.</p>
        </section>
      ) : (
        paginasCotas.map((pagina, pIdx) => (
          <section key={pIdx} className="ficha-pagina mt-6 rounded-xl border border-slate-300 bg-white p-4 text-[10px] print:border-0">
            <h2 className="mb-2 text-sm font-bold">
              ACOMPANHAMENTO DE MEDIÇÃO — OP {op.numero}
              {paginasCotas.length > 1 && ` (página ${pIdx + 1}/${paginasCotas.length})`}
            </h2>
            <table className="mb-2 border-collapse text-[10px]">
              <tbody>
                <tr>
                  <td className="border border-slate-400 bg-slate-50 px-1.5 py-1 font-semibold">Peça</td>
                  <td className="border border-slate-400 px-1.5 py-1">{peca.codigo}</td>
                  <td className="border border-slate-400 bg-slate-50 px-1.5 py-1 font-semibold">Máquina</td>
                  <td className="border border-slate-400 px-1.5 py-1">{maquina?.nome ?? "-"}</td>
                  <td className="border border-slate-400 bg-slate-50 px-1.5 py-1 font-semibold">Data</td>
                  <td className="border border-slate-400 px-24 py-1" />
                </tr>
              </tbody>
            </table>

            <table className="w-full border-collapse text-[9px]">
              <thead>
                <tr>
                  <th className="w-6 border border-slate-400 bg-slate-100" />
                  {pagina.map((c, i) => (
                    <th key={i} className="border border-slate-400 bg-slate-100 px-0.5 py-1 font-semibold">
                      {c.tipo}
                    </th>
                  ))}
                  <th className="w-10 border border-slate-400 bg-slate-100 px-0.5 py-1 font-semibold">Horário</th>
                  <th className="w-14 border border-slate-400 bg-slate-100 px-0.5 py-1 font-semibold">Operador / Rubrica</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-slate-400 bg-slate-50 px-1 py-1 font-semibold">Nominal</td>
                  {pagina.map((c, i) => (
                    <td key={i} className="border border-slate-400 px-1 py-1 text-center">
                      {c.eh_atributo ? "OK/NOK" : numeroOuTraco(c.nominal)}
                    </td>
                  ))}
                  <td className="border border-slate-400" />
                  <td className="border border-slate-400" />
                </tr>
                <tr>
                  <td className="border border-slate-400 bg-slate-50 px-1 py-1 font-semibold">Mínima</td>
                  {pagina.map((c, i) => (
                    <td key={i} className="border border-slate-400 px-1 py-1 text-center">
                      {c.eh_atributo ? "" : numeroOuTraco(c.minimo)}
                    </td>
                  ))}
                  <td className="border border-slate-400" />
                  <td className="border border-slate-400" />
                </tr>
                <tr>
                  <td className="border border-slate-400 bg-slate-50 px-1 py-1 font-semibold">Máxima</td>
                  {pagina.map((c, i) => (
                    <td key={i} className="border border-slate-400 px-1 py-1 text-center">
                      {c.eh_atributo ? "" : numeroOuTraco(c.maximo)}
                    </td>
                  ))}
                  <td className="border border-slate-400" />
                  <td className="border border-slate-400" />
                </tr>
                <tr>
                  <td className="border border-slate-400 bg-slate-200 px-1 py-1 font-semibold">Setup</td>
                  {pagina.map((_, i) => (
                    <td key={i} className="h-5 border border-slate-400" />
                  ))}
                  <td className="border border-slate-400" />
                  <td className="border border-slate-400" />
                </tr>
                {Array.from({ length: LINHAS_MEDICAO }).map((_, linha) => (
                  <tr key={linha}>
                    <td className="border border-slate-400 bg-slate-50 px-1 py-1 text-center font-medium">{linha + 1}</td>
                    {pagina.map((_, i) => (
                      <td key={i} className="h-5 border border-slate-400" />
                    ))}
                    <td className="border border-slate-400" />
                    <td className="border border-slate-400" />
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))
      )}

      {/* Página: desenho técnico */}
      <section className="ficha-pagina mt-6 rounded-xl border border-slate-300 bg-white p-6 text-sm print:border-0">
        <h2 className="mb-3 text-base font-bold">DESENHO TÉCNICO DA PEÇA — {peca.codigo}</h2>
        {!desenhoUrl ? (
          <p className="text-amber-700">Nenhum desenho técnico anexado para esta peça.</p>
        ) : desenhoEhImagem ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={desenhoUrl} alt={`Desenho técnico de ${peca.codigo}`} className="max-h-[240mm] w-full object-contain" />
        ) : (
          <p>
            O desenho desta peça é um PDF anexado —{" "}
            <a href={desenhoUrl} target="_blank" rel="noreferrer" className="text-brand-600 underline">
              abra e imprima separadamente
            </a>
            .
          </p>
        )}
      </section>
    </div>
  );
}
