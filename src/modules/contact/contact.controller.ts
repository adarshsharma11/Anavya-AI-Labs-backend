import type { Context } from "hono";
import { createContactService, getContactsService, updateContactService, deleteContactService } from "./contact.service";
import { checkRateLimit } from "../../lib/rateLimiter";

export const submitContactForm = async (c: Context) => {
  try {
    const body = await c.req.json();
    const { name, email, subject, message } = body;

    // Basic validation
    if (!name || !email || !subject || !message) {
      return c.json({ success: false, message: "All fields are required" }, 400);
    }

    const ip = c.req.header("x-forwarded-for") || "local";

    // Rate limiting to prevent spam
    if (!checkRateLimit(ip)) {
      return c.json(
        {
          success: false,
          message: "Too many requests. Please try again later.",
        },
        429
      );
    }

    const res = await createContactService({ name, email, subject, message });

    return c.json({
      success: true,
      message: "Message received successfully",
      data: res,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};

export const getContacts = async (c: Context) => {
  try {
    const data = await getContactsService();
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};

export const updateContactStatus = async (c: Context) => {
  try {
    const id = Number(c.req.param("id"));
    const body = await c.req.json();
    const { status } = body;

    if (!status) {
      return c.json({ success: false, message: "Status is required" }, 400);
    }

    const updated = await updateContactService(id, status);
    return c.json({ success: true, data: updated });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};

export const deleteContact = async (c: Context) => {
  try {
    const id = Number(c.req.param("id"));
    await deleteContactService(id);
    return c.json({ success: true, message: "Contact request deleted successfully" });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};
