import { getAboutRepo, createAboutRepo } from "./about.repository";
import { fallbackAboutData } from "../../db/seed/about.seed";

export const getAboutService = async () => {
  const list = await getAboutRepo();
  if (list && list.length > 0) {
    return list[0]; // Primary source: Return the latest DB entry
  }
  // Fallback source: Return the first fallback seed data entry
  return fallbackAboutData[0];
};

export const createAboutService = async (body: any) => {
  return await createAboutRepo(body);
};
