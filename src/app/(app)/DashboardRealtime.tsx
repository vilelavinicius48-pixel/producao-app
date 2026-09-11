"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function DashboardRealtime() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("dashboard-producao")
      .on("postgres_changes", { event: "*", schema: "public", table: "ordens_producao" }, () =>
        router.refresh()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "apontamentos" }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "paradas" }, () => router.refresh())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
