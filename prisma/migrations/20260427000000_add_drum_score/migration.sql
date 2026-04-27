-- CreateEnum
CREATE TYPE "DrumScoreStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- AlterTable: add drumScore relation pointer (no column needed, FK is on DrumScore side)

-- CreateTable
CREATE TABLE "DrumScore" (
    "id" TEXT NOT NULL,
    "attachmentId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "data" JSONB,
    "suggestedBpm" INTEGER,
    "status" "DrumScoreStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrumScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DrumScore_attachmentId_key" ON "DrumScore"("attachmentId");

-- AddForeignKey
ALTER TABLE "DrumScore" ADD CONSTRAINT "DrumScore_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrumScore" ADD CONSTRAINT "DrumScore_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
