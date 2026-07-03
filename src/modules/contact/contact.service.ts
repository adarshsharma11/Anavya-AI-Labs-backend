import { createContactRepo, getContactsRepo, updateContactRepo, deleteContactRepo } from "./contact.repository";

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

export const updateContactService = async (id: number, status: string) => {
  return await updateContactRepo(id, { status, updatedAt: new Date() });
};

export const deleteContactService = async (id: number) => {
  await deleteContactRepo(id);
};
