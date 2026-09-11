const COR_BOA = "#0ca30c";
const COR_ALERTA = "#fab219";
const COR_CRITICA = "#d03b3b";
const COR_MUTED = "#c3c2b7";
const COR_TEXTO_SECUNDARIO = "#52514e";
const COR_TEXTO_MUTED = "#898781";
const COR_GRID = "#e1e0d9";

interface Item {
  label: string;
  eficiencia: number | null; // 1 = 100%
}

function corPara(eficiencia: number | null) {
  if (eficiencia === null) return COR_MUTED;
  if (eficiencia >= 1) return COR_BOA;
  if (eficiencia >= 0.8) return COR_ALERTA;
  return COR_CRITICA;
}

export function EficienciaChart({ title, items }: { title: string; items: Item[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-500">Sem dados para o período selecionado</p>
      </div>
    );
  }

  const maiorValor = Math.max(100, ...items.map((i) => (i.eficiencia ?? 0) * 100));
  const domainMax = Math.max(150, Math.ceil((maiorValor * 1.1) / 10) * 10);

  const labelWidth = 140;
  const barHeight = 20;
  const barGap = 14;
  const rowHeight = barHeight + barGap;
  const chartWidth = 420;
  const plotWidth = chartWidth - labelWidth - 48;
  const height = items.length * rowHeight + 28;
  const scale = (v: number) => (v / domainMax) * plotWidth;
  const linha100X = labelWidth + scale(100);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-3 overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartWidth} ${height}`}
          width="100%"
          style={{ minWidth: 320, maxWidth: 480 }}
          role="img"
          aria-label={title}
        >
          <line
            x1={linha100X}
            y1={4}
            x2={linha100X}
            y2={height - 20}
            stroke={COR_GRID}
            strokeWidth={1}
          />
          <text x={linha100X} y={12} fontSize={9} fill={COR_TEXTO_MUTED} textAnchor="middle">
            100%
          </text>

          {items.map((item, i) => {
            const y = 20 + i * rowHeight;
            const eficienciaPct = item.eficiencia !== null ? item.eficiencia * 100 : 0;
            const w = Math.max(scale(eficienciaPct), item.eficiencia !== null ? 2 : 0);
            const cor = corPara(item.eficiencia);
            const valorLabel = item.eficiencia !== null ? `${Math.round(eficienciaPct)}%` : "sem dados";
            return (
              <g key={item.label}>
                <title>
                  {item.label}: {valorLabel}
                </title>
                <text
                  x={labelWidth - 8}
                  y={y + barHeight / 2 + 4}
                  fontSize={11}
                  fill={COR_TEXTO_SECUNDARIO}
                  textAnchor="end"
                >
                  {item.label.length > 18 ? item.label.slice(0, 17) + "…" : item.label}
                </text>
                <rect x={labelWidth} y={y} width={plotWidth} height={barHeight} fill="#f4f4f2" rx={4} />
                {w > 0 && (
                  <rect x={labelWidth} y={y} width={w} height={barHeight} fill={cor} rx={4} />
                )}
                <text
                  x={labelWidth + w + 6}
                  y={y + barHeight / 2 + 4}
                  fontSize={11}
                  fill={COR_TEXTO_SECUNDARIO}
                >
                  {valorLabel}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
