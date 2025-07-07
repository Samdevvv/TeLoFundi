/*
  Warnings:

  - The `status` column on the `agency_registration_requests` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "AgencyRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'UNDER_REVIEW');

-- AlterTable
ALTER TABLE "agency_registration_requests" DROP COLUMN "status",
ADD COLUMN     "status" "AgencyRequestStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "agency_registration_requests_status_idx" ON "agency_registration_requests"("status");

-- AddForeignKey
ALTER TABLE "agency_registration_requests" ADD CONSTRAINT "agency_registration_requests_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
