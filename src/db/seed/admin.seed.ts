import { db } from "../db.js";
import { users } from "../schema/user.js";
import { eq } from "drizzle-orm";

export async function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@anavyaailabs.com";
  // const adminPassword = process.env.ADMIN_PASSWORD || "admin_password_123_change_me";
  const adminPassword = process.env.ADMIN_PASSWORD || "AdminPassword@123!";

  const adminName = process.env.ADMIN_NAME || "Admin";

  const existingAdmin = await db.query.users.findFirst({
    where: eq(users.email, adminEmail),
  });

  const hashedPassword = await Bun.password.hash(adminPassword);

  if (existingAdmin) {
    // Make sure role is admin
    await db.update(users)
      .set({
        name: adminName,
        role: "admin",
        password: hashedPassword,
        emailVerifiedAt: new Date(),
      })
      .where(eq(users.id, existingAdmin.id));
    console.log("✓ Existing admin user role and password updated securely");
  } else {
    // Create new admin user
    await db.insert(users).values({
      email: adminEmail,
      name: adminName,
      username: "admin",
      password: hashedPassword,
      role: "admin",
      authProvider: "local",
      emailVerifiedAt: new Date(),
    });
    console.log("✓ Admin user seeded successfully");
  }
}
