import { RunView } from "@/components/run/RunView";

export default async function RunPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cached?: string }>;
}) {
  const { id } = await params;
  const { cached } = await searchParams;
  return <RunView id={id} cached={cached === "1"} />;
}
