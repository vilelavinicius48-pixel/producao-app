import "server-only";
import { headers } from "next/headers";

/** URL absoluta do app (pra montar o link do QR code), lida da própria requisição. */
export async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}
