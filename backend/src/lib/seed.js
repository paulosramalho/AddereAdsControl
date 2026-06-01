import bcrypt from "bcryptjs";
import prisma from "./prisma.js";

export async function seedSuperAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!email || !password) return;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return;

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { email, passwordHash, name: "Super Admin", role: "SUPER_ADMIN", clientId: null },
  });
  console.log(`Super admin criado: ${email}`);
}
