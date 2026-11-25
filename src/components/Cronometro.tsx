"use client";

import { useEffect, useState } from "react";

function formatDuracao(ms: number) {
  const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function Cronometro({ desde, className }: { desde: string; className?: string }) {
  const inicio = useState(() => new Date(desde).getTime())[0];
  // Começa igual a "inicio" (00:00:00) pra bater com o HTML renderizado no servidor;
  // só depois de montar no cliente é que pula pro tempo real decorrido.
  const [agora, setAgora] = useState(() => inicio);

  useEffect(() => {
    setAgora(Date.now());
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return <span className={className}>{formatDuracao(agora - inicio)}</span>;
}
