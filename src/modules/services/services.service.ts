import {
  getServicesRepo,
  getServicesPageRepo,
  createServiceRepo,
  createPageRepo,
} from "./services.repository";

export const getServicesService = async () => {
  const page = await getServicesPageRepo();
  const list = await getServicesRepo();

  return {
    page,
    services: list,
  };
};

export const createServiceService = async (body:any) => {
  return await createServiceRepo(body);
};

export const createPageService = async (body:any)=>{
  return await createPageRepo(body);
};
