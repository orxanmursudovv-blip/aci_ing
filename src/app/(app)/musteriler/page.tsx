import { getDb } from "@/db";
import { listClients } from "@/server/repo";
import { requireBarber } from "@/server/session";
import { ClientsView } from "./ClientsView";

export default async function ClientsPage() {
  const b = await requireBarber();
  const rows = await listClients(getDb(), b.id);
  return <ClientsView items={rows} />;
}
