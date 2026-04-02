import {
  getPageBySlugRepo,
  createPageRepo,
  updatePageRepo,
} from "./pages.repository";

export const getPageBySlugService = async (slug: string) => {
  return await getPageBySlugRepo(slug);
};

export const createPageService = async (body: any) => {
  return await createPageRepo(body);
};

export const updatePageService = async (slug: string, body: any) => {
  return await updatePageRepo(slug, body);
};
