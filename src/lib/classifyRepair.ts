import { GoogleGenAI } from "@google/genai";
import { GEMINI_API_KEY } from "astro:env/server";
import { REPAIR_CATEGORIES, type RepairCategory } from "@/lib/repairCategories";

export { REPAIR_CATEGORIES, type RepairCategory } from "@/lib/repairCategories";

const PROMPT = `Klasyfikuj opis naprawy samochodu do dokładnie jednej kategorii.
Kategorie: silnik, hamulce, elektryka, ogumienie, przegląd, inne.
Odpowiedz TYLKO nazwą kategorii, bez wyjaśnień.

Opis: `;

export async function classifyRepair(description: string): Promise<RepairCategory | null> {
  if (!GEMINI_API_KEY) return null;

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: PROMPT + description,
      config: {
        maxOutputTokens: 20,
        temperature: 0,
        abortSignal: AbortSignal.timeout(3000),
      },
    });

    const text = response.text?.trim().toLowerCase();
    if (!text) return null;

    const match = REPAIR_CATEGORIES.find((c) => text === c);
    return match ?? null;
  } catch {
    return null;
  }
}
