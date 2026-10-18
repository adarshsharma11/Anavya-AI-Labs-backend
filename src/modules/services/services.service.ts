import {
  getServicesRepo,
  createServiceRepo,
  updateServiceRepo,
  deleteServiceRepo,
} from "./services.repository.js";
import { getPageBySlugService } from "../pages/pages.service.js";

export const getServicesService = async () => {
  const page = await getPageBySlugService("service");
  const list = await getServicesRepo();

  return {
    page,
    services: list,
  };
};

export const createServiceService = async (body: any) => {
  return await createServiceRepo(body);
};

export const updateServiceService = async (id: number, body: any) => {
  return await updateServiceRepo(id, body);
};

export const deleteServiceService = async (id: number) => {
  await deleteServiceRepo(id);
};
