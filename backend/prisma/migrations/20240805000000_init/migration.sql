-- CreateEnum
CREATE TYPE "SubmissionType" AS ENUM ('blog', 'code');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "assignmentCode" VARCHAR(6) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requirements" TEXT NOT NULL,
    "recommendations" TEXT NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "assignmentCode" VARCHAR(6) NOT NULL,
    "userId" TEXT NOT NULL,
    "submissionType" "SubmissionType" NOT NULL,
    "content" TEXT,
    "url" TEXT,
    "title" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "aiFeedback" TEXT NOT NULL,
    "aiScore" JSONB NOT NULL,
    "manualFeedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");

-- CreateIndex
CREATE INDEX "User_discordId_idx" ON "User"("discordId");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_assignmentCode_key" ON "Assignment"("assignmentCode");

-- CreateIndex
CREATE INDEX "Assignment_assignmentCode_idx" ON "Assignment"("assignmentCode");

-- CreateIndex
CREATE INDEX "Assignment_deadline_idx" ON "Assignment"("deadline");

-- CreateIndex
CREATE INDEX "Submission_assignmentCode_idx" ON "Submission"("assignmentCode");

-- CreateIndex
CREATE INDEX "Submission_userId_idx" ON "Submission"("userId");

-- CreateIndex
CREATE INDEX "Submission_submittedAt_idx" ON "Submission"("submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_submissionId_key" ON "Feedback"("submissionId");

-- CreateIndex
CREATE INDEX "Feedback_submissionId_idx" ON "Feedback"("submissionId");

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_assignmentCode_fkey" FOREIGN KEY ("assignmentCode") REFERENCES "Assignment"("assignmentCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;