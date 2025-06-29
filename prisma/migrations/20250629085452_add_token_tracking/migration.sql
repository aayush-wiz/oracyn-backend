-- AlterTable
ALTER TABLE "Chart" ADD COLUMN "tokensUsed" INTEGER DEFAULT 0;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "tokensUsed" INTEGER DEFAULT 0;
