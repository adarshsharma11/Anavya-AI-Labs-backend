import { createContactRepo, getContactsRepo } from "./contact.repository";

export const createContactService = async (data: {
  name: string;
  email: string;
  subject: string;
  message: string;
}) => {
  return await createContactRepo(data);
};

export const getContactsService = async () => {
  return await getContactsRepo();
};
