-- Add position and evaluationCriteria columns to assignments table
ALTER TABLE "assignments" 
ADD COLUMN IF NOT EXISTS "position" VARCHAR(50),
ADD COLUMN IF NOT EXISTS "evaluationCriteria" TEXT;

-- Create index for position column for better query performance
CREATE INDEX IF NOT EXISTS "idx_assignment_position" ON "assignments"("position");

-- Update existing assignments to have appropriate position values based on category
UPDATE "assignments" 
SET "position" = CASE 
    WHEN "category" = 'frontend' THEN 'frontend_react'
    WHEN "category" = 'backend' THEN 'backend_fastapi'
    ELSE NULL
END
WHERE "position" IS NULL;