import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REPAIR_CATEGORIES } from "@/lib/repairCategories";

interface Props {
  repairId: string;
  currentCategory: string | null;
  onCategoryChange: (category: string) => void;
}

export default function CategorySelect({ repairId, currentCategory, onCategoryChange }: Props) {
  const [saving, setSaving] = useState(false);

  async function handleChange(value: string) {
    const previous = currentCategory;
    onCategoryChange(value);
    setSaving(true);
    try {
      const response = await fetch(`/api/repairs/${repairId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: value }),
      });
      if (!response.ok) {
        if (previous) onCategoryChange(previous);
      }
    } catch {
      if (previous) onCategoryChange(previous);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Select value={currentCategory ?? ""} onValueChange={(v) => void handleChange(v)} disabled={saving}>
      <SelectTrigger className="h-7 w-[120px] border-white/10 bg-white/5 text-xs text-blue-100/80">
        <SelectValue placeholder="Category" />
      </SelectTrigger>
      <SelectContent className="border-white/10 bg-slate-900">
        {REPAIR_CATEGORIES.map((cat) => (
          <SelectItem key={cat} value={cat} className="text-xs text-blue-100/80">
            {cat}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
