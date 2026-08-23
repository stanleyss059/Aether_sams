-- Topic quizzes are not tied to an uploaded file.
ALTER TABLE "Quiz" ALTER COLUMN "documentId" DROP NOT NULL;
