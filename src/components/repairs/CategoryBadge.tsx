import { cn } from "@/lib/utils";

const CATEGORY_STYLES: Record<string, string> = {
  silnik: "bg-red-500/20 text-red-300 border-red-500/30",
  hamulce: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  elektryka: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  ogumienie: "bg-green-500/20 text-green-300 border-green-500/30",
  przegląd: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  inne: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  pending: "bg-white/5 text-blue-100/40 border-white/10",
};

export default function CategoryBadge({ category }: { category: string | null }) {
  if (!category) {
    return <span className="text-xs text-blue-100/30">—</span>;
  }

  const style = CATEGORY_STYLES[category] ?? CATEGORY_STYLES.inne;

  return (
    <span className={cn("inline-block rounded-full border px-2 py-0.5 text-xs font-medium", style)}>
      {category === "pending" ? "Pending" : category}
    </span>
  );
}
