import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password.js";

const prisma = new PrismaClient();

async function main() {
  const email = "student@aether.app";
  const passwordHash = await hashPassword("Aether2026!");
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name: "Ada Okonkwo", email, passwordHash },
  });
  console.log("Seed complete. Demo: student@aether.app / Aether2026!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
