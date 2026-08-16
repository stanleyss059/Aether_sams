import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password.js";

const prisma = new PrismaClient();

async function main() {
  const email = "student@studyforge.app";
  const passwordHash = await hashPassword("StudyForge2026!");
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name: "Ada Okonkwo", email, passwordHash },
  });
  console.log("Seed complete. Demo: student@studyforge.app / StudyForge2026!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
