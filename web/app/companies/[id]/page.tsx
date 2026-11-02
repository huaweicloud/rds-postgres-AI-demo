import { redirect } from "next/navigation";
import { serviceClient } from "@/lib/server";

// A company's page is its latest finished run.
export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await serviceClient()
    .from("research_runs")
    .select("id")
    .eq("company_id", id)
    .eq("status", "done")
    .order("created_at", { ascending: false })
    .limit(1);
  if (data?.[0]) redirect(`/runs/${data[0].id}`);
  return <p className="muted">No finished run for this company yet.</p>;
}
