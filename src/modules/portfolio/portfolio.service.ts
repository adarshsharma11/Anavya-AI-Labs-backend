import {
  getPortfolioRepo,
  getPortfolioBySlugRepo,
  createPortfolioRepo,
  updatePortfolioRepo,
  deletePortfolioRepo,
} from "./portfolio.repository";

export const getPortfolioService = async () => {
  return await getPortfolioRepo();
};

export const getPortfolioBySlugService = async (slug: string) => {
  return await getPortfolioBySlugRepo(slug);
};

export const createPortfolioService = async (data: any) => {
  return await createPortfolioRepo(data);
};

export const updatePortfolioService = async (slug: string, data: any) => {
  return await updatePortfolioRepo(slug, data);
};

export const deletePortfolioService = async (slug: string) => {
  return await deletePortfolioRepo(slug);
};
