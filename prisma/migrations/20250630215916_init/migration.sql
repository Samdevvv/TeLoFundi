-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('ESCORT', 'AGENCY', 'CLIENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'PENDING_APPROVAL', 'SUSPENDED', 'BANNED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'UNDER_REVIEW');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MODERATOR');

-- CreateEnum
CREATE TYPE "PremiumTier" AS ENUM ('BASIC', 'PREMIUM', 'VIP');

-- CreateEnum
CREATE TYPE "PointAction" AS ENUM ('PREMIUM_DAY', 'CHAT_PRIORITY', 'EXTRA_FAVORITE', 'PROFILE_BOOST', 'PHONE_ACCESS', 'IMAGE_MESSAGE');

-- CreateEnum
CREATE TYPE "RateLimitType" AS ENUM ('DAILY_MESSAGES', 'HOURLY_MESSAGES', 'PHONE_ACCESS', 'IMAGE_MESSAGES', 'VOICE_MESSAGES', 'FILE_UPLOADS');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AgencyRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'MEMBER');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('ADMIN', 'MODERATOR', 'MEMBER');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'ESCALATED', 'CLOSED');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'FILE', 'AUDIO', 'VIDEO', 'SYSTEM', 'LOCATION', 'CONTACT');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('SPAM', 'INAPPROPRIATE_CONTENT', 'FAKE_PROFILE', 'SCAM', 'HARASSMENT', 'COPYRIGHT', 'UNDERAGE', 'VIOLENCE', 'FRAUD', 'IMPERSONATION', 'ADULT_CONTENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'RESOLVED', 'REJECTED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "ReportSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'UNDER_REVIEW');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('MESSAGE', 'LIKE', 'FAVORITE', 'REVIEW', 'BOOST_EXPIRED', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'AGENCY_INVITE', 'VERIFICATION_COMPLETED', 'VERIFICATION_EXPIRING', 'MEMBERSHIP_REQUEST', 'SYSTEM', 'TRENDING', 'PROMOTION', 'SECURITY_ALERT', 'SUBSCRIPTION_EXPIRING', 'NEW_FOLLOWER', 'POST_APPROVED', 'POST_REJECTED', 'PROFILE_INCOMPLETE', 'AGENCY_APPROVED', 'AGENCY_REJECTED', 'POINTS_LOW', 'DAILY_POINTS_AVAILABLE', 'PREMIUM_EXPIRED');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED', 'DISPUTED', 'PROCESSING');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('BOOST', 'PREMIUM', 'POINTS', 'VERIFICATION', 'SUBSCRIPTION', 'TIP', 'COMMISSION', 'POST_ADDITIONAL', 'STACK_BOOST');

-- CreateEnum
CREATE TYPE "BoostType" AS ENUM ('BASIC', 'PREMIUM', 'FEATURED', 'SUPER', 'MEGA');

-- CreateEnum
CREATE TYPE "PointTransactionType" AS ENUM ('PURCHASE', 'BONUS_POINTS', 'DAILY_LOGIN', 'REGISTRATION_BONUS', 'REFERRAL_REWARD', 'STREAK_BONUS', 'PREMIUM_DAY', 'CHAT_PRIORITY', 'EXTRA_FAVORITE', 'PROFILE_BOOST', 'PHONE_ACCESS', 'IMAGE_MESSAGE', 'REFUND', 'ADMIN_ADJUSTMENT', 'EXPIRED_PREMIUM');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('VIEW', 'LIKE', 'CHAT', 'PROFILE_VISIT', 'POST_CLICK', 'FAVORITE', 'SHARE', 'REPORT', 'BOOST_VIEW', 'CONTACT_CLICK', 'IMAGE_VIEW', 'PHONE_VIEW', 'LOCATION_VIEW', 'WHATSAPP_CLICK', 'WHATSAPP_OPEN', 'TIME_SPENT');

-- CreateEnum
CREATE TYPE "BanSeverity" AS ENUM ('WARNING', 'TEMPORARY', 'PERMANENT', 'SHADOW');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED', 'PAUSED', 'PENDING', 'PAST_DUE');

-- CreateEnum
CREATE TYPE "TagCategory" AS ENUM ('GENERAL', 'SERVICE', 'LOCATION', 'PHYSICAL', 'PREFERENCE', 'SPECIAL');

-- CreateEnum
CREATE TYPE "ContentFilterLevel" AS ENUM ('NONE', 'MODERATE', 'STRICT');

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "state" TEXT,
    "city" TEXT NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "avatar" TEXT,
    "phone" TEXT,
    "bio" TEXT,
    "website" TEXT,
    "userType" "UserType" NOT NULL,
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "canLogin" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT,
    "profileViews" INTEGER NOT NULL DEFAULT 0,
    "passwordResetToken" TEXT,
    "passwordResetExpiry" TIMESTAMP(3),
    "emailVerificationToken" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" TIMESTAMP(3),
    "locationId" TEXT,
    "timezone" TEXT DEFAULT 'UTC',
    "language" TEXT DEFAULT 'en',
    "lastLoginIP" TEXT,
    "lastDailyReset" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLogin" TIMESTAMP(3),
    "lastActiveAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "deletionReason" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_registration_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "businessPhone" TEXT NOT NULL,
    "businessEmail" TEXT NOT NULL,
    "documentFrontImage" TEXT NOT NULL,
    "documentBackImage" TEXT NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNotes" TEXT,
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,

    CONSTRAINT "agency_registration_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "pushNotifications" BOOLEAN NOT NULL DEFAULT true,
    "messageNotifications" BOOLEAN NOT NULL DEFAULT true,
    "likeNotifications" BOOLEAN NOT NULL DEFAULT true,
    "boostNotifications" BOOLEAN NOT NULL DEFAULT true,
    "profileReminders" BOOLEAN NOT NULL DEFAULT true,
    "verificationReminders" BOOLEAN NOT NULL DEFAULT true,
    "showOnline" BOOLEAN NOT NULL DEFAULT true,
    "showLastSeen" BOOLEAN NOT NULL DEFAULT true,
    "allowDirectMessages" BOOLEAN NOT NULL DEFAULT true,
    "showPhoneNumber" BOOLEAN NOT NULL DEFAULT false,
    "showInDiscovery" BOOLEAN NOT NULL DEFAULT true,
    "showInTrending" BOOLEAN NOT NULL DEFAULT true,
    "showInSearch" BOOLEAN NOT NULL DEFAULT true,
    "contentFilter" "ContentFilterLevel" NOT NULL DEFAULT 'MODERATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "deviceInfo" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "filters" JSONB,
    "results" INTEGER NOT NULL DEFAULT 0,
    "clicked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_blocks" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_verifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "documentImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "selfieImage" TEXT,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedBy" TEXT,
    "rejectionReason" TEXT,
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "identity_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "duration" INTEGER NOT NULL,
    "features" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userType" "UserType" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "maxPosts" INTEGER,
    "maxImages" INTEGER,
    "maxBoosts" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "stripeSubscriptionId" TEXT,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "postsUsed" INTEGER NOT NULL DEFAULT 0,
    "imagesUsed" INTEGER NOT NULL DEFAULT 0,
    "boostsUsed" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "category" "TagCategory" NOT NULL DEFAULT 'GENERAL',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_tags" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'MODERATOR',
    "permissions" JSONB,
    "totalBans" INTEGER NOT NULL DEFAULT 0,
    "totalReports" INTEGER NOT NULL DEFAULT 0,
    "totalVerifications" INTEGER NOT NULL DEFAULT 0,
    "totalAgencyApprovals" INTEGER NOT NULL DEFAULT 0,
    "canDeletePosts" BOOLEAN NOT NULL DEFAULT false,
    "canBanUsers" BOOLEAN NOT NULL DEFAULT false,
    "canModifyPrices" BOOLEAN NOT NULL DEFAULT false,
    "canAccessMetrics" BOOLEAN NOT NULL DEFAULT false,
    "canApproveAgencies" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_reputations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "responseRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averageResponseTime" INTEGER,
    "profileCompleteness" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trustScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalViews" INTEGER NOT NULL DEFAULT 0,
    "totalLikes" INTEGER NOT NULL DEFAULT 0,
    "totalMessages" INTEGER NOT NULL DEFAULT 0,
    "totalFavorites" INTEGER NOT NULL DEFAULT 0,
    "discoveryScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastScoreUpdate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "spamScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reportScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_reputations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escorts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "verificationExpiresAt" TIMESTAMP(3),
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "totalRatings" INTEGER NOT NULL DEFAULT 0,
    "age" INTEGER,
    "height" TEXT,
    "weight" TEXT,
    "bodyType" TEXT,
    "ethnicity" TEXT,
    "hairColor" TEXT,
    "eyeColor" TEXT,
    "services" TEXT,
    "rates" JSONB,
    "availability" JSONB,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maxPosts" INTEGER NOT NULL DEFAULT 3,
    "currentPosts" INTEGER NOT NULL DEFAULT 0,
    "totalBookings" INTEGER NOT NULL DEFAULT 0,
    "completedBookings" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "escorts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agencies" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "companyName" TEXT NOT NULL,
    "businessLicense" TEXT,
    "contactPerson" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "cedulaFrente" TEXT,
    "cedulaTrasera" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "taxId" TEXT,
    "maxPosts" INTEGER,
    "totalEscorts" INTEGER NOT NULL DEFAULT 0,
    "verifiedEscorts" INTEGER NOT NULL DEFAULT 0,
    "totalVerifications" INTEGER NOT NULL DEFAULT 0,
    "activeEscorts" INTEGER NOT NULL DEFAULT 0,
    "defaultCommissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.1,

    CONSTRAINT "agencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 10,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "premiumUntil" TIMESTAMP(3),
    "premiumTier" "PremiumTier" NOT NULL DEFAULT 'BASIC',
    "lastDailyPointsClaim" TIMESTAMP(3),
    "dailyLoginStreak" INTEGER NOT NULL DEFAULT 0,
    "totalDailyPointsEarned" INTEGER NOT NULL DEFAULT 0,
    "totalPointsEarned" INTEGER NOT NULL DEFAULT 10,
    "totalPointsSpent" INTEGER NOT NULL DEFAULT 0,
    "pointsLastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maxFavorites" INTEGER NOT NULL DEFAULT 5,
    "currentFavorites" INTEGER NOT NULL DEFAULT 0,
    "dailyMessageLimit" INTEGER NOT NULL DEFAULT 5,
    "messagesUsedToday" INTEGER NOT NULL DEFAULT 0,
    "canViewPhoneNumbers" BOOLEAN NOT NULL DEFAULT false,
    "canSendImages" BOOLEAN NOT NULL DEFAULT false,
    "canSendVoiceMessages" BOOLEAN NOT NULL DEFAULT false,
    "canAccessPremiumProfiles" BOOLEAN NOT NULL DEFAULT false,
    "prioritySupport" BOOLEAN NOT NULL DEFAULT false,
    "canSeeOnlineStatus" BOOLEAN NOT NULL DEFAULT false,
    "totalMessagesUsed" INTEGER NOT NULL DEFAULT 0,
    "lastMessageReset" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalPointsPurchased" INTEGER NOT NULL DEFAULT 0,
    "agePreferenceMin" INTEGER,
    "agePreferenceMax" INTEGER,
    "locationPreference" TEXT,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points_packages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "bonus" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "points_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points_purchases" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "pointsPurchased" INTEGER NOT NULL,
    "bonusPoints" INTEGER NOT NULL DEFAULT 0,
    "totalPoints" INTEGER NOT NULL,
    "amountPaid" DOUBLE PRECISION NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "stripePaymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "points_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_transactions" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "PointTransactionType" NOT NULL,
    "description" TEXT,
    "cost" DOUBLE PRECISION,
    "postId" TEXT,
    "messageId" TEXT,
    "paymentId" TEXT,
    "purchaseId" TEXT,
    "actionId" TEXT,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "metadata" JSONB,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points_history" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" "PointTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "metadata" JSONB,
    "source" TEXT,
    "purchaseId" TEXT,
    "actionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "premium_activations" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "tier" "PremiumTier" NOT NULL,
    "duration" INTEGER NOT NULL,
    "pointsCost" INTEGER NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "activatedBy" TEXT NOT NULL DEFAULT 'points',

    CONSTRAINT "premium_activations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_reviews" (
    "id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "communication" INTEGER,
    "punctuality" INTEGER,
    "appearance" INTEGER,
    "overall" INTEGER,
    "service" INTEGER,
    "value" INTEGER,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "clientId" TEXT NOT NULL,
    "escortId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "client_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "bannedBy" TEXT NOT NULL,
    "adminId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "severity" "BanSeverity" NOT NULL DEFAULT 'WARNING',
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ban_appeals" (
    "id" TEXT NOT NULL,
    "banId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" JSONB,
    "status" "AppealStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "ban_appeals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_interactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "postId" TEXT,
    "type" "InteractionType" NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "duration" INTEGER,
    "whatsappOpened" BOOLEAN NOT NULL DEFAULT false,
    "deviceType" TEXT,
    "source" TEXT,
    "location" TEXT,
    "sessionId" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_rate_limits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "limitType" "RateLimitType" NOT NULL DEFAULT 'DAILY_MESSAGES',

    CONSTRAINT "chat_rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_memberships" (
    "id" TEXT NOT NULL,
    "escortId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'PENDING',
    "role" "AgencyRole" NOT NULL DEFAULT 'MEMBER',
    "commissionRate" DOUBLE PRECISION DEFAULT 0.1,
    "canPostForAgency" BOOLEAN NOT NULL DEFAULT false,
    "canManageEscorts" BOOLEAN NOT NULL DEFAULT false,
    "canAccessFinances" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "agency_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_invitations" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "escortId" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "proposedCommission" DOUBLE PRECISION DEFAULT 0.1,
    "proposedRole" "AgencyRole" NOT NULL DEFAULT 'MEMBER',
    "proposedBenefits" JSONB,
    "invitedBy" TEXT NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "agency_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escort_verifications" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "escortId" TEXT NOT NULL,
    "pricingId" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "membershipId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isAutoRenewal" BOOLEAN NOT NULL DEFAULT false,
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "documentsSubmitted" JSONB,
    "verificationNotes" TEXT,
    "rejectionReason" TEXT,
    "verificationSteps" JSONB,
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "escort_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_pricing" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "features" JSONB,
    "duration" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boost_pricing" (
    "id" TEXT NOT NULL,
    "type" "BoostType" NOT NULL,
    "duration" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "features" JSONB,
    "maxBoosts" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boost_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "phone" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "views" INTEGER NOT NULL DEFAULT 0,
    "viewsToday" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "clicksToday" INTEGER NOT NULL DEFAULT 0,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "engagementRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastBoosted" TIMESTAMP(3),
    "locationId" TEXT,
    "services" TEXT,
    "rates" JSONB,
    "availability" JSONB,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isTrending" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "discoveryScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastScoreUpdate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "premiumOnly" BOOLEAN NOT NULL DEFAULT false,
    "uniqueViews" INTEGER NOT NULL DEFAULT 0,
    "totalTime" INTEGER NOT NULL DEFAULT 0,
    "bounceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "whatsappClicks" INTEGER NOT NULL DEFAULT 0,
    "hasActiveBoost" BOOLEAN NOT NULL DEFAULT false,
    "boostEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "authorId" TEXT NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trending_history" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "category" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trending_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chats" (
    "id" TEXT NOT NULL,
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "description" TEXT,
    "avatar" TEXT,
    "isDisputeChat" BOOLEAN NOT NULL DEFAULT false,
    "disputeStatus" "DisputeStatus" NOT NULL DEFAULT 'ACTIVE',
    "disputeReason" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "mutedUntil" TIMESTAMP(3),
    "maxMembers" INTEGER DEFAULT 100,
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "requireApproval" BOOLEAN NOT NULL DEFAULT false,
    "allowFiles" BOOLEAN NOT NULL DEFAULT true,
    "allowImages" BOOLEAN NOT NULL DEFAULT true,
    "allowVoice" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_members" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRead" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "role" "ChatRole" NOT NULL DEFAULT 'MEMBER',
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "maxMessages" INTEGER NOT NULL DEFAULT 3,
    "canAddMembers" BOOLEAN NOT NULL DEFAULT false,
    "canDeleteMessages" BOOLEAN NOT NULL DEFAULT false,
    "canManageChat" BOOLEAN NOT NULL DEFAULT false,
    "messagesCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "chat_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "content" TEXT,
    "messageType" "MessageType" NOT NULL DEFAULT 'TEXT',
    "fileUrl" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "costPoints" INTEGER,
    "isPremiumMessage" BOOLEAN NOT NULL DEFAULT false,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMP(3),
    "isForwarded" BOOLEAN NOT NULL DEFAULT false,
    "replyToId" TEXT,
    "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT,
    "chatId" TEXT NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "isNotified" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "likes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "professionalism" INTEGER,
    "communication" INTEGER,
    "reliability" INTEGER,
    "appearance" INTEGER,
    "service" INTEGER,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "helpfulVotes" INTEGER NOT NULL DEFAULT 0,
    "authorId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "description" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "evidence" JSONB,
    "category" TEXT,
    "severity" "ReportSeverity" NOT NULL DEFAULT 'LOW',
    "resolution" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "actionTaken" TEXT,
    "authorId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "postId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "expiresAt" TIMESTAMP(3),
    "isSent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "deliveryMethod" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isEmailSent" BOOLEAN NOT NULL DEFAULT false,
    "emailSentAt" TIMESTAMP(3),
    "actionUrl" TEXT,
    "actionText" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "type" "PaymentType" NOT NULL,
    "description" TEXT,
    "stripePaymentId" TEXT,
    "metadata" JSONB,
    "failureReason" TEXT,
    "refundReason" TEXT,
    "processorFee" DOUBLE PRECISION,
    "netAmount" DOUBLE PRECISION,
    "taxAmount" DOUBLE PRECISION,
    "taxRate" DOUBLE PRECISION,
    "clientId" TEXT,
    "escortId" TEXT,
    "agencyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boosts" (
    "id" TEXT NOT NULL,
    "pricingId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "viewsBefore" INTEGER NOT NULL DEFAULT 0,
    "viewsAfter" INTEGER NOT NULL DEFAULT 0,
    "clicksBefore" INTEGER NOT NULL DEFAULT 0,
    "clicksAfter" INTEGER NOT NULL DEFAULT 0,
    "engagementBefore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "engagementAfter" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conversionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "targetAudience" JSONB,
    "geography" TEXT,
    "stackLevel" INTEGER NOT NULL DEFAULT 1,
    "isStackBoost" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "boosts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_metrics" (
    "id" TEXT NOT NULL,
    "totalUsers" INTEGER NOT NULL DEFAULT 0,
    "totalEscorts" INTEGER NOT NULL DEFAULT 0,
    "totalAgencies" INTEGER NOT NULL DEFAULT 0,
    "totalClients" INTEGER NOT NULL DEFAULT 0,
    "totalAdmins" INTEGER NOT NULL DEFAULT 0,
    "totalPosts" INTEGER NOT NULL DEFAULT 0,
    "totalPayments" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activeUsers" INTEGER NOT NULL DEFAULT 0,
    "bannedUsers" INTEGER NOT NULL DEFAULT 0,
    "verifiedEscorts" INTEGER NOT NULL DEFAULT 0,
    "premiumClients" INTEGER NOT NULL DEFAULT 0,
    "pendingAgencies" INTEGER NOT NULL DEFAULT 0,
    "totalVerifications" INTEGER NOT NULL DEFAULT 0,
    "expiredVerifications" INTEGER NOT NULL DEFAULT 0,
    "totalPointsSold" INTEGER NOT NULL DEFAULT 0,
    "totalPointsSpent" INTEGER NOT NULL DEFAULT 0,
    "totalBoosts" INTEGER NOT NULL DEFAULT 0,
    "pointsRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dailyLoginStreaks" INTEGER NOT NULL DEFAULT 0,
    "totalMessages" INTEGER NOT NULL DEFAULT 0,
    "averageSessionTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conversionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "churnRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "revenuePerUser" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "basicClients" INTEGER NOT NULL DEFAULT 0,
    "premiumClientsTier" INTEGER NOT NULL DEFAULT 0,
    "vipClients" INTEGER NOT NULL DEFAULT 0,
    "dailyActiveUsers" INTEGER NOT NULL DEFAULT 0,
    "weeklyActiveUsers" INTEGER NOT NULL DEFAULT 0,
    "monthlyActiveUsers" INTEGER NOT NULL DEFAULT 0,
    "topCountries" JSONB,
    "topCities" JSONB,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "locations_country_city_idx" ON "locations"("country", "city");

-- CreateIndex
CREATE UNIQUE INDEX "locations_country_state_city_key" ON "locations"("country", "state", "city");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_userType_isActive_createdAt_idx" ON "users"("userType", "isActive", "createdAt");

-- CreateIndex
CREATE INDEX "users_userType_isActive_lastLogin_idx" ON "users"("userType", "isActive", "lastLogin");

-- CreateIndex
CREATE INDEX "users_userType_isActive_lastActiveAt_idx" ON "users"("userType", "isActive", "lastActiveAt");

-- CreateIndex
CREATE INDEX "users_accountStatus_idx" ON "users"("accountStatus");

-- CreateIndex
CREATE INDEX "users_canLogin_userType_idx" ON "users"("canLogin", "userType");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE INDEX "users_lastLogin_idx" ON "users"("lastLogin");

-- CreateIndex
CREATE INDEX "users_isActive_userType_idx" ON "users"("isActive", "userType");

-- CreateIndex
CREATE INDEX "users_profileViews_idx" ON "users"("profileViews");

-- CreateIndex
CREATE INDEX "users_locationId_idx" ON "users"("locationId");

-- CreateIndex
CREATE INDEX "users_emailVerificationToken_idx" ON "users"("emailVerificationToken");

-- CreateIndex
CREATE INDEX "users_passwordResetToken_idx" ON "users"("passwordResetToken");

-- CreateIndex
CREATE INDEX "users_emailVerified_idx" ON "users"("emailVerified");

-- CreateIndex
CREATE INDEX "users_lastDailyReset_idx" ON "users"("lastDailyReset");

-- CreateIndex
CREATE UNIQUE INDEX "agency_registration_requests_userId_key" ON "agency_registration_requests"("userId");

-- CreateIndex
CREATE INDEX "agency_registration_requests_status_idx" ON "agency_registration_requests"("status");

-- CreateIndex
CREATE INDEX "agency_registration_requests_submittedAt_idx" ON "agency_registration_requests"("submittedAt");

-- CreateIndex
CREATE INDEX "agency_registration_requests_reviewedBy_idx" ON "agency_registration_requests"("reviewedBy");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_userId_key" ON "user_settings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_token_key" ON "device_tokens"("token");

-- CreateIndex
CREATE INDEX "device_tokens_userId_isActive_idx" ON "device_tokens"("userId", "isActive");

-- CreateIndex
CREATE INDEX "device_tokens_platform_isActive_idx" ON "device_tokens"("platform", "isActive");

-- CreateIndex
CREATE INDEX "search_history_userId_createdAt_idx" ON "search_history"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "search_history_query_idx" ON "search_history"("query");

-- CreateIndex
CREATE INDEX "user_blocks_blockedId_idx" ON "user_blocks"("blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "user_blocks_blockerId_blockedId_key" ON "user_blocks"("blockerId", "blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "identity_verifications_userId_key" ON "identity_verifications"("userId");

-- CreateIndex
CREATE INDEX "identity_verifications_status_idx" ON "identity_verifications"("status");

-- CreateIndex
CREATE INDEX "identity_verifications_documentType_idx" ON "identity_verifications"("documentType");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_name_key" ON "subscription_plans"("name");

-- CreateIndex
CREATE INDEX "subscription_plans_userType_isActive_idx" ON "subscription_plans"("userType", "isActive");

-- CreateIndex
CREATE INDEX "subscription_plans_price_userType_idx" ON "subscription_plans"("price", "userType");

-- CreateIndex
CREATE INDEX "subscriptions_userId_status_idx" ON "subscriptions"("userId", "status");

-- CreateIndex
CREATE INDEX "subscriptions_status_endsAt_idx" ON "subscriptions"("status", "endsAt");

-- CreateIndex
CREATE INDEX "subscriptions_planId_status_idx" ON "subscriptions"("planId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE INDEX "tags_isActive_usageCount_idx" ON "tags"("isActive", "usageCount");

-- CreateIndex
CREATE INDEX "tags_category_isActive_idx" ON "tags"("category", "isActive");

-- CreateIndex
CREATE INDEX "tags_priority_isActive_idx" ON "tags"("priority", "isActive");

-- CreateIndex
CREATE INDEX "post_tags_tagId_idx" ON "post_tags"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "post_tags_postId_tagId_key" ON "post_tags"("postId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "admins_userId_key" ON "admins"("userId");

-- CreateIndex
CREATE INDEX "admins_role_idx" ON "admins"("role");

-- CreateIndex
CREATE UNIQUE INDEX "user_reputations_userId_key" ON "user_reputations"("userId");

-- CreateIndex
CREATE INDEX "user_reputations_overallScore_idx" ON "user_reputations"("overallScore");

-- CreateIndex
CREATE INDEX "user_reputations_trustScore_idx" ON "user_reputations"("trustScore");

-- CreateIndex
CREATE INDEX "user_reputations_discoveryScore_idx" ON "user_reputations"("discoveryScore");

-- CreateIndex
CREATE INDEX "user_reputations_trendingScore_idx" ON "user_reputations"("trendingScore");

-- CreateIndex
CREATE UNIQUE INDEX "escorts_userId_key" ON "escorts"("userId");

-- CreateIndex
CREATE INDEX "escorts_isVerified_rating_idx" ON "escorts"("isVerified", "rating");

-- CreateIndex
CREATE INDEX "escorts_rating_totalRatings_idx" ON "escorts"("rating", "totalRatings");

-- CreateIndex
CREATE INDEX "escorts_currentPosts_maxPosts_idx" ON "escorts"("currentPosts", "maxPosts");

-- CreateIndex
CREATE INDEX "escorts_age_idx" ON "escorts"("age");

-- CreateIndex
CREATE INDEX "escorts_verificationExpiresAt_idx" ON "escorts"("verificationExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "agencies_userId_key" ON "agencies"("userId");

-- CreateIndex
CREATE INDEX "agencies_isVerified_idx" ON "agencies"("isVerified");

-- CreateIndex
CREATE INDEX "agencies_totalEscorts_idx" ON "agencies"("totalEscorts");

-- CreateIndex
CREATE INDEX "agencies_activeEscorts_idx" ON "agencies"("activeEscorts");

-- CreateIndex
CREATE INDEX "agencies_verificationStatus_idx" ON "agencies"("verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "clients_userId_key" ON "clients"("userId");

-- CreateIndex
CREATE INDEX "clients_isPremium_premiumTier_idx" ON "clients"("isPremium", "premiumTier");

-- CreateIndex
CREATE INDEX "clients_points_idx" ON "clients"("points");

-- CreateIndex
CREATE INDEX "clients_premiumUntil_idx" ON "clients"("premiumUntil");

-- CreateIndex
CREATE INDEX "clients_totalPointsSpent_idx" ON "clients"("totalPointsSpent");

-- CreateIndex
CREATE INDEX "clients_maxFavorites_currentFavorites_idx" ON "clients"("maxFavorites", "currentFavorites");

-- CreateIndex
CREATE INDEX "clients_dailyMessageLimit_messagesUsedToday_idx" ON "clients"("dailyMessageLimit", "messagesUsedToday");

-- CreateIndex
CREATE INDEX "clients_lastDailyPointsClaim_idx" ON "clients"("lastDailyPointsClaim");

-- CreateIndex
CREATE INDEX "clients_dailyLoginStreak_idx" ON "clients"("dailyLoginStreak");

-- CreateIndex
CREATE UNIQUE INDEX "points_packages_name_key" ON "points_packages"("name");

-- CreateIndex
CREATE INDEX "points_packages_isActive_isPopular_idx" ON "points_packages"("isActive", "isPopular");

-- CreateIndex
CREATE INDEX "points_packages_price_idx" ON "points_packages"("price");

-- CreateIndex
CREATE INDEX "points_purchases_clientId_status_idx" ON "points_purchases"("clientId", "status");

-- CreateIndex
CREATE INDEX "points_purchases_status_createdAt_idx" ON "points_purchases"("status", "createdAt");

-- CreateIndex
CREATE INDEX "point_transactions_clientId_createdAt_idx" ON "point_transactions"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "point_transactions_type_createdAt_idx" ON "point_transactions"("type", "createdAt");

-- CreateIndex
CREATE INDEX "point_transactions_amount_type_idx" ON "point_transactions"("amount", "type");

-- CreateIndex
CREATE INDEX "points_history_clientId_createdAt_idx" ON "points_history"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "points_history_type_createdAt_idx" ON "points_history"("type", "createdAt");

-- CreateIndex
CREATE INDEX "points_history_createdAt_idx" ON "points_history"("createdAt");

-- CreateIndex
CREATE INDEX "premium_activations_clientId_isActive_idx" ON "premium_activations"("clientId", "isActive");

-- CreateIndex
CREATE INDEX "premium_activations_expiresAt_isActive_idx" ON "premium_activations"("expiresAt", "isActive");

-- CreateIndex
CREATE INDEX "client_reviews_escortId_rating_idx" ON "client_reviews"("escortId", "rating");

-- CreateIndex
CREATE INDEX "client_reviews_rating_createdAt_idx" ON "client_reviews"("rating", "createdAt");

-- CreateIndex
CREATE INDEX "client_reviews_createdAt_idx" ON "client_reviews"("createdAt");

-- CreateIndex
CREATE INDEX "client_reviews_isVerified_rating_idx" ON "client_reviews"("isVerified", "rating");

-- CreateIndex
CREATE UNIQUE INDEX "client_reviews_clientId_escortId_key" ON "client_reviews"("clientId", "escortId");

-- CreateIndex
CREATE INDEX "bans_userId_isActive_idx" ON "bans"("userId", "isActive");

-- CreateIndex
CREATE INDEX "bans_isActive_expiresAt_idx" ON "bans"("isActive", "expiresAt");

-- CreateIndex
CREATE INDEX "bans_severity_isActive_idx" ON "bans"("severity", "isActive");

-- CreateIndex
CREATE INDEX "bans_bannedBy_idx" ON "bans"("bannedBy");

-- CreateIndex
CREATE INDEX "ban_appeals_banId_idx" ON "ban_appeals"("banId");

-- CreateIndex
CREATE INDEX "ban_appeals_status_idx" ON "ban_appeals"("status");

-- CreateIndex
CREATE INDEX "user_interactions_userId_type_createdAt_idx" ON "user_interactions"("userId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "user_interactions_targetUserId_type_idx" ON "user_interactions"("targetUserId", "type");

-- CreateIndex
CREATE INDEX "user_interactions_postId_type_idx" ON "user_interactions"("postId", "type");

-- CreateIndex
CREATE INDEX "user_interactions_type_createdAt_idx" ON "user_interactions"("type", "createdAt");

-- CreateIndex
CREATE INDEX "user_interactions_type_weight_createdAt_idx" ON "user_interactions"("type", "weight", "createdAt");

-- CreateIndex
CREATE INDEX "user_interactions_source_type_idx" ON "user_interactions"("source", "type");

-- CreateIndex
CREATE INDEX "user_interactions_whatsappOpened_idx" ON "user_interactions"("whatsappOpened");

-- CreateIndex
CREATE INDEX "chat_rate_limits_windowStart_limitType_idx" ON "chat_rate_limits"("windowStart", "limitType");

-- CreateIndex
CREATE UNIQUE INDEX "chat_rate_limits_userId_limitType_key" ON "chat_rate_limits"("userId", "limitType");

-- CreateIndex
CREATE INDEX "agency_memberships_agencyId_status_idx" ON "agency_memberships"("agencyId", "status");

-- CreateIndex
CREATE INDEX "agency_memberships_status_createdAt_idx" ON "agency_memberships"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "agency_memberships_escortId_agencyId_key" ON "agency_memberships"("escortId", "agencyId");

-- CreateIndex
CREATE INDEX "agency_invitations_escortId_status_idx" ON "agency_invitations"("escortId", "status");

-- CreateIndex
CREATE INDEX "agency_invitations_status_createdAt_idx" ON "agency_invitations"("status", "createdAt");

-- CreateIndex
CREATE INDEX "agency_invitations_expiresAt_status_idx" ON "agency_invitations"("expiresAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "agency_invitations_agencyId_escortId_key" ON "agency_invitations"("agencyId", "escortId");

-- CreateIndex
CREATE INDEX "escort_verifications_escortId_status_idx" ON "escort_verifications"("escortId", "status");

-- CreateIndex
CREATE INDEX "escort_verifications_agencyId_status_idx" ON "escort_verifications"("agencyId", "status");

-- CreateIndex
CREATE INDEX "escort_verifications_status_createdAt_idx" ON "escort_verifications"("status", "createdAt");

-- CreateIndex
CREATE INDEX "escort_verifications_expiresAt_reminderSent_idx" ON "escort_verifications"("expiresAt", "reminderSent");

-- CreateIndex
CREATE INDEX "verification_pricing_isActive_idx" ON "verification_pricing"("isActive");

-- CreateIndex
CREATE INDEX "verification_pricing_cost_isActive_idx" ON "verification_pricing"("cost", "isActive");

-- CreateIndex
CREATE INDEX "boost_pricing_type_isActive_idx" ON "boost_pricing"("type", "isActive");

-- CreateIndex
CREATE INDEX "boost_pricing_price_isActive_idx" ON "boost_pricing"("price", "isActive");

-- CreateIndex
CREATE INDEX "boost_pricing_isActive_idx" ON "boost_pricing"("isActive");

-- CreateIndex
CREATE INDEX "posts_isActive_createdAt_idx" ON "posts"("isActive", "createdAt");

-- CreateIndex
CREATE INDEX "posts_authorId_isActive_idx" ON "posts"("authorId", "isActive");

-- CreateIndex
CREATE INDEX "posts_score_isActive_idx" ON "posts"("score", "isActive");

-- CreateIndex
CREATE INDEX "posts_trendingScore_isTrending_isActive_idx" ON "posts"("trendingScore", "isTrending", "isActive");

-- CreateIndex
CREATE INDEX "posts_lastBoosted_isActive_idx" ON "posts"("lastBoosted", "isActive");

-- CreateIndex
CREATE INDEX "posts_score_lastBoosted_isActive_idx" ON "posts"("score", "lastBoosted", "isActive");

-- CreateIndex
CREATE INDEX "posts_views_isActive_idx" ON "posts"("views", "isActive");

-- CreateIndex
CREATE INDEX "posts_engagementRate_isActive_idx" ON "posts"("engagementRate", "isActive");

-- CreateIndex
CREATE INDEX "posts_discoveryScore_isActive_idx" ON "posts"("discoveryScore", "isActive");

-- CreateIndex
CREATE INDEX "posts_locationId_isActive_idx" ON "posts"("locationId", "isActive");

-- CreateIndex
CREATE INDEX "posts_isFeatured_isActive_idx" ON "posts"("isFeatured", "isActive");

-- CreateIndex
CREATE INDEX "posts_premiumOnly_isActive_idx" ON "posts"("premiumOnly", "isActive");

-- CreateIndex
CREATE INDEX "posts_hasActiveBoost_boostEndsAt_idx" ON "posts"("hasActiveBoost", "boostEndsAt");

-- CreateIndex
CREATE INDEX "posts_whatsappClicks_isActive_idx" ON "posts"("whatsappClicks", "isActive");

-- CreateIndex
CREATE INDEX "trending_history_date_position_idx" ON "trending_history"("date", "position");

-- CreateIndex
CREATE INDEX "trending_history_postId_date_idx" ON "trending_history"("postId", "date");

-- CreateIndex
CREATE INDEX "trending_history_category_date_idx" ON "trending_history"("category", "date");

-- CreateIndex
CREATE INDEX "chats_isGroup_isArchived_idx" ON "chats"("isGroup", "isArchived");

-- CreateIndex
CREATE INDEX "chats_lastActivity_idx" ON "chats"("lastActivity");

-- CreateIndex
CREATE INDEX "chats_isDisputeChat_disputeStatus_idx" ON "chats"("isDisputeChat", "disputeStatus");

-- CreateIndex
CREATE INDEX "chat_members_chatId_idx" ON "chat_members"("chatId");

-- CreateIndex
CREATE INDEX "chat_members_userId_idx" ON "chat_members"("userId");

-- CreateIndex
CREATE INDEX "chat_members_lastRead_idx" ON "chat_members"("lastRead");

-- CreateIndex
CREATE INDEX "chat_members_messageCount_maxMessages_idx" ON "chat_members"("messageCount", "maxMessages");

-- CreateIndex
CREATE UNIQUE INDEX "chat_members_userId_chatId_key" ON "chat_members"("userId", "chatId");

-- CreateIndex
CREATE INDEX "messages_chatId_createdAt_idx" ON "messages"("chatId", "createdAt");

-- CreateIndex
CREATE INDEX "messages_senderId_idx" ON "messages"("senderId");

-- CreateIndex
CREATE INDEX "messages_receiverId_idx" ON "messages"("receiverId");

-- CreateIndex
CREATE INDEX "messages_isPremiumMessage_idx" ON "messages"("isPremiumMessage");

-- CreateIndex
CREATE INDEX "messages_isRead_chatId_idx" ON "messages"("isRead", "chatId");

-- CreateIndex
CREATE INDEX "messages_replyToId_idx" ON "messages"("replyToId");

-- CreateIndex
CREATE INDEX "messages_costPoints_idx" ON "messages"("costPoints");

-- CreateIndex
CREATE INDEX "favorites_userId_idx" ON "favorites"("userId");

-- CreateIndex
CREATE INDEX "favorites_postId_idx" ON "favorites"("postId");

-- CreateIndex
CREATE INDEX "favorites_createdAt_idx" ON "favorites"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_userId_postId_key" ON "favorites"("userId", "postId");

-- CreateIndex
CREATE INDEX "likes_postId_idx" ON "likes"("postId");

-- CreateIndex
CREATE INDEX "likes_userId_idx" ON "likes"("userId");

-- CreateIndex
CREATE INDEX "likes_createdAt_idx" ON "likes"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "likes_userId_postId_key" ON "likes"("userId", "postId");

-- CreateIndex
CREATE INDEX "reviews_targetId_rating_idx" ON "reviews"("targetId", "rating");

-- CreateIndex
CREATE INDEX "reviews_rating_createdAt_idx" ON "reviews"("rating", "createdAt");

-- CreateIndex
CREATE INDEX "reviews_createdAt_idx" ON "reviews"("createdAt");

-- CreateIndex
CREATE INDEX "reviews_isVerified_rating_idx" ON "reviews"("isVerified", "rating");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_authorId_targetId_key" ON "reviews"("authorId", "targetId");

-- CreateIndex
CREATE INDEX "reports_status_createdAt_idx" ON "reports"("status", "createdAt");

-- CreateIndex
CREATE INDEX "reports_reason_status_idx" ON "reports"("reason", "status");

-- CreateIndex
CREATE INDEX "reports_authorId_idx" ON "reports"("authorId");

-- CreateIndex
CREATE INDEX "reports_resolvedBy_idx" ON "reports"("resolvedBy");

-- CreateIndex
CREATE INDEX "reports_severity_status_idx" ON "reports"("severity", "status");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_createdAt_idx" ON "notifications"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_priority_createdAt_idx" ON "notifications"("priority", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_expiresAt_idx" ON "notifications"("expiresAt");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_type_isRead_idx" ON "notifications"("type", "isRead");

-- CreateIndex
CREATE INDEX "notifications_isEmailSent_emailSentAt_idx" ON "notifications"("isEmailSent", "emailSentAt");

-- CreateIndex
CREATE INDEX "payments_clientId_status_idx" ON "payments"("clientId", "status");

-- CreateIndex
CREATE INDEX "payments_escortId_status_idx" ON "payments"("escortId", "status");

-- CreateIndex
CREATE INDEX "payments_agencyId_status_idx" ON "payments"("agencyId", "status");

-- CreateIndex
CREATE INDEX "payments_status_createdAt_idx" ON "payments"("status", "createdAt");

-- CreateIndex
CREATE INDEX "payments_type_status_idx" ON "payments"("type", "status");

-- CreateIndex
CREATE INDEX "payments_amount_type_idx" ON "payments"("amount", "type");

-- CreateIndex
CREATE INDEX "payments_stripePaymentId_idx" ON "payments"("stripePaymentId");

-- CreateIndex
CREATE INDEX "boosts_isActive_expiresAt_idx" ON "boosts"("isActive", "expiresAt");

-- CreateIndex
CREATE INDEX "boosts_postId_isActive_idx" ON "boosts"("postId", "isActive");

-- CreateIndex
CREATE INDEX "boosts_userId_idx" ON "boosts"("userId");

-- CreateIndex
CREATE INDEX "boosts_expiresAt_idx" ON "boosts"("expiresAt");

-- CreateIndex
CREATE INDEX "boosts_stackLevel_isStackBoost_idx" ON "boosts"("stackLevel", "isStackBoost");

-- CreateIndex
CREATE INDEX "app_metrics_date_idx" ON "app_metrics"("date");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_registration_requests" ADD CONSTRAINT "agency_registration_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_history" ADD CONSTRAINT "search_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_verifications" ADD CONSTRAINT "identity_verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admins" ADD CONSTRAINT "admins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_reputations" ADD CONSTRAINT "user_reputations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escorts" ADD CONSTRAINT "escorts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agencies" ADD CONSTRAINT "agencies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_purchases" ADD CONSTRAINT "points_purchases_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_purchases" ADD CONSTRAINT "points_purchases_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "points_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_history" ADD CONSTRAINT "points_history_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "premium_activations" ADD CONSTRAINT "premium_activations_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_reviews" ADD CONSTRAINT "client_reviews_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_reviews" ADD CONSTRAINT "client_reviews_escortId_fkey" FOREIGN KEY ("escortId") REFERENCES "escorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bans" ADD CONSTRAINT "bans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ban_appeals" ADD CONSTRAINT "ban_appeals_banId_fkey" FOREIGN KEY ("banId") REFERENCES "bans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interactions" ADD CONSTRAINT "user_interactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interactions" ADD CONSTRAINT "user_interactions_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interactions" ADD CONSTRAINT "user_interactions_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_rate_limits" ADD CONSTRAINT "chat_rate_limits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_memberships" ADD CONSTRAINT "agency_memberships_escortId_fkey" FOREIGN KEY ("escortId") REFERENCES "escorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_memberships" ADD CONSTRAINT "agency_memberships_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_invitations" ADD CONSTRAINT "agency_invitations_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_invitations" ADD CONSTRAINT "agency_invitations_escortId_fkey" FOREIGN KEY ("escortId") REFERENCES "escorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escort_verifications" ADD CONSTRAINT "escort_verifications_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escort_verifications" ADD CONSTRAINT "escort_verifications_escortId_fkey" FOREIGN KEY ("escortId") REFERENCES "escorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escort_verifications" ADD CONSTRAINT "escort_verifications_pricingId_fkey" FOREIGN KEY ("pricingId") REFERENCES "verification_pricing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trending_history" ADD CONSTRAINT "trending_history_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_members" ADD CONSTRAINT "chat_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_members" ADD CONSTRAINT "chat_members_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "escorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "escorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boosts" ADD CONSTRAINT "boosts_pricingId_fkey" FOREIGN KEY ("pricingId") REFERENCES "boost_pricing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boosts" ADD CONSTRAINT "boosts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boosts" ADD CONSTRAINT "boosts_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
