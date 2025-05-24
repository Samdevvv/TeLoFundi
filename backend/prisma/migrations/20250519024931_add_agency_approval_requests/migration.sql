-- CreateTable
CREATE TABLE "agency_approval_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "agency_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendiente',
    "request_email" TEXT NOT NULL,
    "request_data" JSONB,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "notes" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agency_approval_requests_pkey" PRIMARY KEY ("id")
);
