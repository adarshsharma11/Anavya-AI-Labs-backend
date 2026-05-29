import { getAboutRepo, createAboutRepo } from "./about.repository";
import { fallbackAboutData } from "../../db/seed/about.seed";
import { db } from "../../db/db";
import { scans } from "../../db/schema/scan";
import { sql } from "drizzle-orm";

export const getAboutService = async () => {
  const list = await getAboutRepo();
  const rawAbout = list && list.length > 0 ? list[0] : fallbackAboutData[0];
  
  // Clone to avoid mutating fallbackAboutData directly or raw database results
  const aboutData = JSON.parse(JSON.stringify(rawAbout));

  try {
    const countResult = await db.select({ value: sql<number>`count(*)` }).from(scans);
    const totalScans = Number(countResult[0]?.value ?? 0);

    if (aboutData && Array.isArray(aboutData.highlights)) {
      aboutData.highlights = aboutData.highlights.map((highlight: any) => {
        if (highlight.label?.toLowerCase() === "sites analyzed") {
          return {
            ...highlight,
            value: String(totalScans),
          };
        }
        return highlight;
      });
    }
  } catch (error) {
    console.error("Failed to query scan count for about highlights:", error);
  }

  return aboutData;
};

export const createAboutService = async (body: any) => {
  return await createAboutRepo(body);
};
