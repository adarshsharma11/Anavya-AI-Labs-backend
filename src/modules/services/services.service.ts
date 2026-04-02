import {
  getServicesRepo,
  createServiceRepo,
} from "./services.repository";
import { getPageBySlugService } from "../pages/pages.service";

export const getServicesService = async () => {
  const page = await getPageBySlugService("service");
  const list = await getServicesRepo();

  return {
    page,
    services: list,
  };
};

export const createServiceService = async (body:any) => {
  return await createServiceRepo(body);
};
