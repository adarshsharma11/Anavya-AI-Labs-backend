import { Hono } from "hono";
import { submitContactForm, getContacts } from "../../../modules/contact/contact.controller";
import { verifyToken } from "../../../middlewares/auth.middleware";

const contactRoute = new Hono();

// Public route for submitting contact form
contactRoute.post("/contact", submitContactForm);

// Protected route for admins to view contacts
contactRoute.get("/contact", verifyToken, getContacts);

export default contactRoute;
