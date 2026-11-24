import { requireGestor } from "@/lib/auth";
import { PcpTabs } from "./PcpTabs";

export default async function PcpLayout({ children }: { children: React.ReactNode }) {
  await requireGestor();
  return (
    <div>
      <PcpTabs />
      {children}
    </div>
  );
}
