export const REPAIR_CATEGORIES = ["silnik", "hamulce", "elektryka", "ogumienie", "przegląd", "inne"] as const;
export type RepairCategory = (typeof REPAIR_CATEGORIES)[number];
