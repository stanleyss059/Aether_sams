import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  const email = "student@studyforge.app";
  const passwordHash = await argon2.hash("StudyForge2026!", {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
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
