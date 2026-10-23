import {
  getBlogsRepo,
  getAllBlogsRepo,
  getBlogBySlugRepo,
  getPublishedBlogBySlugRepo,
  createBlogRepo,
  updateBlogRepo,
  deleteBlogRepo,
} from "./blogs.repository.js";

export const getBlogsService = async () => {
  return await getBlogsRepo();
};

export const getAllBlogsService = async () => {
  return await getAllBlogsRepo();
};

export const getPublishedBlogBySlugService = async (slug: string) => {
  return await getPublishedBlogBySlugRepo(slug);
};

export const getBlogBySlugService = async (slug: string) => {
  return await getBlogBySlugRepo(slug);
};

export const createBlogService = async (data: any) => {
  return await createBlogRepo(data);
};

export const updateBlogService = async (slug: string, data: any) => {
  return await updateBlogRepo(slug, data);
};

export const deleteBlogService = async (slug: string) => {
  return await deleteBlogRepo(slug);
};