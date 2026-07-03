import { Hono } from "hono";
import { submitContactForm, getContacts, updateContactStatus, deleteContact } from "../../../modules/contact/contact.controller";
import { verifyAdminToken } from "../../../middlewares/auth.middleware";

const contactRoute = new Hono();

// Public route for submitting contact form
contactRoute.post("/contact", submitContactForm);

// Protected routes for admins to manage contacts
contactRoute.get("/contact", verifyAdminToken, getContacts);
contactRoute.put("/contact/:id", verifyAdminToken, updateContactStatus);
contactRoute.delete("/contact/:id", verifyAdminToken, deleteContact);

export default contactRoute;
