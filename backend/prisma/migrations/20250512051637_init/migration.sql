-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('cliente', 'perfil', 'agencia', 'admin');

-- CreateEnum
CREATE TYPE "GenderType" AS ENUM ('femenino', 'masculino', 'transgenero', 'otro');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('no_verificado', 'pendiente', 'verificado', 'rechazado', 'expirado');

-- CreateEnum
CREATE TYPE "PointAction" AS ENUM ('registro', 'login_diario', 'contacto_perfil', 'compra', 'referido', 'uso_plataforma', 'sorteo', 'completar_perfil', 'verificacion', 'recompensa_admin', 'devolucion');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('enviado', 'entregado', 'leido', 'eliminado');

-- CreateEnum
CREATE TYPE "AuthMethod" AS ENUM ('email_password', 'google', 'facebook', 'apple', 'phone');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('tarjeta_credito', 'tarjeta_debito', 'paypal', 'stripe', 'transferencia_bancaria', 'mercado_pago', 'crypto', 'apple_pay', 'google_pay', 'efectivo');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pendiente', 'procesando', 'completado', 'fallido', 'reembolsado', 'disputado', 'cancelado');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('paquete_cupones', 'membresia_vip', 'servicio_destacado', 'verificacion', 'publicidad', 'suscripcion_agencia', 'comision_plataforma');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('dni', 'pasaporte', 'licencia_conducir', 'comprobante_domicilio', 'selfie_verificacion', 'certificado_sanitario', 'otro');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('desktop', 'mobile', 'tablet', 'app_android', 'app_ios');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('disponible', 'ocupado', 'no_disponible', 'vacaciones');

-- CreateEnum
CREATE TYPE "ContactMethod" AS ENUM ('telefono', 'whatsapp', 'chat_interno', 'email');

-- CreateEnum
CREATE TYPE "VipLevel" AS ENUM ('basico', 'silver', 'gold', 'platinum');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('mensaje_nuevo', 'contacto_nuevo', 'puntos_ganados', 'verificacion_completada', 'cupon_expirando', 'sorteo_ganado', 'servicio_expirando', 'perfil_actualizado', 'pago_completado', 'pago_fallido', 'sistema', 'recordatorio');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('contenido_inapropiado', 'perfil_falso', 'suplantacion_identidad', 'actividades_ilegales', 'acoso', 'spam', 'otro');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('open', 'in_progress', 'waiting', 'resolved', 'closed');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verification_token" TEXT,
    "email_verification_expires" TIMESTAMP(3),
    "phone" TEXT,
    "phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "phone_verification_code" TEXT,
    "phone_verification_expires" TIMESTAMP(3),
    "password_hash" TEXT,
    "role" "UserRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_vip" BOOLEAN NOT NULL DEFAULT false,
    "vip_level" "VipLevel",
    "last_login" TIMESTAMP(3),
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "account_locked" BOOLEAN NOT NULL DEFAULT false,
    "account_locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "ip_address" TEXT,
    "last_ip_address" TEXT,
    "user_agent" TEXT,
    "preferred_language" TEXT NOT NULL DEFAULT 'es',
    "marketing_opt_in" BOOLEAN NOT NULL DEFAULT false,
    "terms_accepted_at" TIMESTAMP(3),
    "privacy_accepted_at" TIMESTAMP(3),
    "profile_image_url" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_auth" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "AuthMethod" NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "provider_email" TEXT,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "profile_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_auth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "device_type" "DeviceType",
    "device_info" JSONB,
    "location" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_activity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "username" TEXT,
    "total_points" INTEGER NOT NULL DEFAULT 0,
    "vip_until" TIMESTAMP(3),
    "preferences" JSONB,
    "favorite_profiles" JSONB,
    "blocked_profiles" JSONB,
    "last_activity" TIMESTAMP(3),
    "referral_code" TEXT,
    "referred_by" TEXT,
    "total_contacts" INTEGER NOT NULL DEFAULT 0,
    "verified_account" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agencies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "short_description" TEXT,
    "website" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state_province" TEXT,
    "country" TEXT,
    "postal_code" TEXT,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'no_verificado',
    "verified_at" TIMESTAMP(3),
    "verified_by" TEXT,
    "logo_url" TEXT,
    "cover_image_url" TEXT,
    "gallery_images" JSONB,
    "social_media" JSONB,
    "business_hours" JSONB,
    "commission_rate" DECIMAL(65,30),
    "commission_structure" JSONB,
    "subscription_tier" TEXT,
    "subscription_expires" TIMESTAMP(3),
    "payment_methods" JSONB,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "contact_whatsapp" TEXT,
    "total_profiles" INTEGER NOT NULL DEFAULT 0,
    "active_profiles" INTEGER NOT NULL DEFAULT 0,
    "verified_profiles" INTEGER NOT NULL DEFAULT 0,
    "rating" DECIMAL(65,30),
    "total_ratings" INTEGER NOT NULL DEFAULT 0,
    "featured_until" TIMESTAMP(3),
    "tax_id" TEXT,
    "legal_name" TEXT,
    "legal_representative" TEXT,
    "establishment_year" INTEGER,
    "is_exclusive" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "agencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "real_name" TEXT,
    "gender" "GenderType" NOT NULL,
    "birth_date" DATE,
    "age" INTEGER,
    "agency_id" TEXT,
    "description" TEXT,
    "short_description" TEXT,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'no_verificado',
    "verified_at" TIMESTAMP(3),
    "verified_by" TEXT,
    "verification_expires" TIMESTAMP(3),
    "height" INTEGER,
    "weight" INTEGER,
    "measurements" TEXT,
    "eye_color" TEXT,
    "hair_color" TEXT,
    "skin_tone" TEXT,
    "nationality" TEXT,
    "languages" JSONB,
    "location" JSONB,
    "travel_availability" BOOLEAN NOT NULL DEFAULT false,
    "travel_destinations" JSONB,
    "services" JSONB,
    "price_hour" DECIMAL(65,30),
    "price_additional_hour" DECIMAL(65,30),
    "price_overnight" DECIMAL(65,30),
    "price_weekend" DECIMAL(65,30),
    "price_travel" DECIMAL(65,30),
    "discount_packages" JSONB,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "payment_methods" JSONB,
    "availability_status" "AvailabilityStatus" NOT NULL DEFAULT 'disponible',
    "availability_schedule" JSONB,
    "contact_methods" JSONB,
    "preferred_contact_hours" JSONB,
    "is_independent" BOOLEAN NOT NULL DEFAULT false,
    "total_views" INTEGER NOT NULL DEFAULT 0,
    "total_contacts" INTEGER NOT NULL DEFAULT 0,
    "total_favorites" INTEGER NOT NULL DEFAULT 0,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "featured_until" TIMESTAMP(3),
    "boost_until" TIMESTAMP(3),
    "search_boost_factor" INTEGER NOT NULL DEFAULT 1,
    "last_activity" TIMESTAMP(3),
    "has_health_certificate" BOOLEAN NOT NULL DEFAULT false,
    "health_certificate_expires" TIMESTAMP(3),
    "orientation" TEXT,
    "personality_tags" JSONB,
    "interests" JSONB,
    "tattoos" BOOLEAN NOT NULL DEFAULT false,
    "piercings" BOOLEAN NOT NULL DEFAULT false,
    "smoker" BOOLEAN NOT NULL DEFAULT false,
    "education_level" TEXT,
    "about_me" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_images" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "medium_url" TEXT,
    "is_main" BOOLEAN NOT NULL DEFAULT false,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "upload_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "order_position" INTEGER NOT NULL DEFAULT 0,
    "blur_hash" TEXT,
    "content_type" TEXT NOT NULL DEFAULT 'image/jpeg',
    "file_size" INTEGER,
    "dimensions" JSONB,
    "tags" JSONB,

    CONSTRAINT "profile_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" "PointAction" NOT NULL,
    "points" INTEGER NOT NULL,
    "reference_id" TEXT,
    "reference_type" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "expiration_date" TIMESTAMP(3),
    "is_expired" BOOLEAN NOT NULL DEFAULT false,
    "transaction_batch" TEXT,

    CONSTRAINT "point_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_balance_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "previous_balance" INTEGER NOT NULL,
    "new_balance" INTEGER NOT NULL,
    "transaction_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_balance_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_packages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "short_description" TEXT,
    "price" DECIMAL(65,30) NOT NULL,
    "discount_price" DECIMAL(65,30),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "points_granted" INTEGER NOT NULL,
    "sorteo_entries" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "min_purchase_level" INTEGER NOT NULL DEFAULT 0,
    "max_purchases_per_user" INTEGER,
    "total_available" INTEGER,
    "image_url" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "coupon_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_package_items" (
    "id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "discount_percentage" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "valid_days" INTEGER NOT NULL DEFAULT 30,
    "min_purchase_amount" DECIMAL(65,30),
    "max_discount_amount" DECIMAL(65,30),
    "applicable_services" JSONB,

    CONSTRAINT "coupon_package_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_coupons" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "package_item_id" TEXT,
    "code" TEXT NOT NULL,
    "discount_percentage" INTEGER NOT NULL,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "used_for" TEXT,
    "used_in_payment" TEXT,
    "is_transferable" BOOLEAN NOT NULL DEFAULT false,
    "transferred_to" TEXT,
    "transferred_at" TIMESTAMP(3),
    "original_owner" TEXT,

    CONSTRAINT "user_coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "blocked_by" TEXT,
    "last_message_at" TIMESTAMP(3),
    "total_messages" INTEGER NOT NULL DEFAULT 0,
    "unread_client" INTEGER NOT NULL DEFAULT 0,
    "unread_profile" INTEGER NOT NULL DEFAULT 0,
    "last_message_preview" TEXT,
    "metadata" JSONB,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "content_type" TEXT NOT NULL DEFAULT 'text',
    "attachments" JSONB,
    "status" "MessageStatus" NOT NULL DEFAULT 'enviado',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "deleted_by_sender" BOOLEAN NOT NULL DEFAULT false,
    "deleted_by_recipient" BOOLEAN NOT NULL DEFAULT false,
    "reaction" TEXT,
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "edited_at" TIMESTAMP(3),
    "original_content" TEXT,
    "metadata" JSONB,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_contacts" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "contactMethod" "ContactMethod" NOT NULL,
    "contact_data" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "points_awarded" BOOLEAN NOT NULL DEFAULT false,
    "points_transaction_id" TEXT,
    "initiated_by" TEXT,
    "is_successful" BOOLEAN,
    "notes" TEXT,
    "location" JSONB,
    "device_info" JSONB,

    CONSTRAINT "profile_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_views" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "viewer_id" TEXT,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "session_id" TEXT,
    "deviceType" "DeviceType",
    "device_info" JSONB,
    "referrer" TEXT,
    "duration" INTEGER,
    "location" JSONB,
    "search_query" TEXT,

    CONSTRAINT "profile_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods_saved" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT NOT NULL,
    "provider_token" TEXT,
    "card_last_four" TEXT,
    "card_brand" TEXT,
    "card_expiry_month" INTEGER,
    "card_expiry_year" INTEGER,
    "billing_name" TEXT,
    "billing_address" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,

    CONSTRAINT "payment_methods_saved_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "payment_type" "PaymentType" NOT NULL,
    "reference_id" TEXT,
    "reference_type" TEXT,
    "payment_method" "PaymentMethod" NOT NULL,
    "payment_method_id" TEXT,
    "provider" TEXT NOT NULL,
    "provider_transaction_id" TEXT,
    "provider_fee" DECIMAL(65,30),
    "platform_fee" DECIMAL(65,30),
    "total_fees" DECIMAL(65,30),
    "net_amount" DECIMAL(65,30),
    "status" "PaymentStatus" NOT NULL DEFAULT 'pendiente',
    "status_detail" TEXT,
    "status_updated_at" TIMESTAMP(3),
    "coupon_id" TEXT,
    "discount_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tax_rate" DECIMAL(65,30),
    "billing_address" JSONB,
    "invoice_number" TEXT,
    "invoice_url" TEXT,
    "receipt_url" TEXT,
    "refund_id" TEXT,
    "refund_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "canceled_at" TIMESTAMP(3),
    "canceled_reason" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "device_info" JSONB,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_status_history" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "previous_status" "PaymentStatus",
    "new_status" "PaymentStatus" NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_by" TEXT,
    "reason" TEXT,
    "metadata" JSONB,

    CONSTRAINT "payment_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT,
    "user_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "invoice_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" TIMESTAMP(3),
    "total_amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'emitida',
    "paid_at" TIMESTAMP(3),
    "pdf_url" TEXT,
    "items" JSONB,
    "billing_details" JSONB,
    "tax_details" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "reason" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "approved_by" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pendiente',
    "provider_refund_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "premium_services" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "short_description" TEXT,
    "price" DECIMAL(65,30) NOT NULL,
    "discount_price" DECIMAL(65,30),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "duration_days" INTEGER NOT NULL,
    "service_type" TEXT NOT NULL,
    "benefits" JSONB,
    "applies_to" TEXT NOT NULL,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "image_url" TEXT,
    "max_purchases" INTEGER,
    "total_available" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "premium_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_premium_services" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "profile_id" TEXT,
    "agency_id" TEXT,
    "payment_id" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "auto_renew" BOOLEAN NOT NULL DEFAULT false,
    "canceled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "user_premium_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vip_memberships" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "short_description" TEXT,
    "price" DECIMAL(65,30) NOT NULL,
    "discount_price" DECIMAL(65,30),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "duration_days" INTEGER NOT NULL,
    "level" "VipLevel" NOT NULL,
    "points_multiplier" DECIMAL(65,30) NOT NULL DEFAULT 1.0,
    "signup_points" INTEGER NOT NULL DEFAULT 0,
    "benefits" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "image_url" TEXT,
    "max_purchases" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "vip_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_vip_memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "payment_id" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "auto_renew" BOOLEAN NOT NULL DEFAULT false,
    "canceled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "points_awarded" BOOLEAN NOT NULL DEFAULT false,
    "points_transaction_id" TEXT,

    CONSTRAINT "user_vip_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raffles" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "short_description" TEXT,
    "prize_description" TEXT NOT NULL,
    "prize_value" DECIMAL(65,30),
    "prize_image_url" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "drawing_date" TIMESTAMP(3),
    "min_points_required" INTEGER NOT NULL DEFAULT 0,
    "points_per_entry" INTEGER NOT NULL DEFAULT 10,
    "max_entries_per_user" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "requires_vip" BOOLEAN NOT NULL DEFAULT false,
    "min_vip_level" "VipLevel",
    "winner_id" TEXT,
    "winner_selected_at" TIMESTAMP(3),
    "winner_notified" BOOLEAN NOT NULL DEFAULT false,
    "winner_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "prize_delivered" BOOLEAN NOT NULL DEFAULT false,
    "prize_delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "total_entries" INTEGER NOT NULL DEFAULT 0,
    "rules_text" TEXT,

    CONSTRAINT "raffles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raffle_entries" (
    "id" TEXT NOT NULL,
    "raffle_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "points_spent" INTEGER NOT NULL DEFAULT 0,
    "entries_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "points_transaction_id" TEXT,
    "entry_number" INTEGER,
    "is_winner" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "raffle_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_changes" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "previous_agency_id" TEXT,
    "new_agency_id" TEXT,
    "change_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requested_by" TEXT,
    "approved_by" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pendiente',
    "reason" TEXT,
    "notes" TEXT,

    CONSTRAINT "agency_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "points_for_registration" INTEGER NOT NULL DEFAULT 50,
    "points_for_daily_login" INTEGER NOT NULL DEFAULT 5,
    "points_for_contact" INTEGER NOT NULL DEFAULT 10,
    "points_for_referral" INTEGER NOT NULL DEFAULT 25,
    "points_for_profile_completion" INTEGER NOT NULL DEFAULT 15,
    "vip_points_multiplier" DECIMAL(65,30) NOT NULL DEFAULT 2.0,
    "min_points_for_coupon" INTEGER NOT NULL DEFAULT 100,
    "points_expiration_days" INTEGER NOT NULL DEFAULT 365,
    "default_currency" TEXT NOT NULL DEFAULT 'USD',
    "min_profile_images" INTEGER NOT NULL DEFAULT 1,
    "max_profile_images" INTEGER NOT NULL DEFAULT 20,
    "max_agency_profiles" INTEGER DEFAULT 100,
    "contact_methods_enabled" JSONB NOT NULL DEFAULT '[]',
    "maintenance_mode" BOOLEAN NOT NULL DEFAULT false,
    "maintenance_message" TEXT,
    "maximum_login_attempts" INTEGER NOT NULL DEFAULT 5,
    "account_lockout_minutes" INTEGER NOT NULL DEFAULT 30,
    "verification_required_for_profiles" BOOLEAN NOT NULL DEFAULT false,
    "auto_verification_expiration_days" INTEGER NOT NULL DEFAULT 90,
    "platform_commission_percentage" DECIMAL(65,30) NOT NULL DEFAULT 10.00,
    "vip_commission_discount" DECIMAL(65,30) NOT NULL DEFAULT 2.00,
    "search_boost_vip_factor" INTEGER NOT NULL DEFAULT 2,
    "search_boost_featured_factor" INTEGER NOT NULL DEFAULT 3,
    "search_boost_verified_factor" INTEGER NOT NULL DEFAULT 2,
    "default_search_radius" INTEGER NOT NULL DEFAULT 50,
    "default_pagination_limit" INTEGER NOT NULL DEFAULT 20,
    "settings" JSONB,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_verifications" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "agency_id" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'pendiente',
    "verification_date" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "verified_by" TEXT,
    "verification_method" TEXT,
    "verification_location" TEXT,
    "notes" TEXT,
    "document_urls" JSONB,
    "verification_photo_url" TEXT,
    "payment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_documents" (
    "id" TEXT NOT NULL,
    "verification_id" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "document_url" TEXT NOT NULL,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_by" TEXT,
    "verified_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "notes" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "verification_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_metrics" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "views_count" INTEGER NOT NULL DEFAULT 0,
    "contacts_count" INTEGER NOT NULL DEFAULT 0,
    "chats_initiated_count" INTEGER NOT NULL DEFAULT 0,
    "search_appearances_count" INTEGER NOT NULL DEFAULT 0,
    "favorite_count" INTEGER NOT NULL DEFAULT 0,
    "clicks_to_contact_count" INTEGER NOT NULL DEFAULT 0,
    "contact_conversion_rate" DECIMAL(65,30),
    "avg_chat_response_time" INTEGER,
    "avg_view_time" INTEGER,
    "total_earnings" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "last_calculated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metrics_period" TEXT NOT NULL DEFAULT 'monthly',
    "period_start" DATE,
    "period_end" DATE,
    "geographic_distribution" JSONB,
    "traffic_sources" JSONB,
    "search_keywords" JSONB,

    CONSTRAINT "profile_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_searches" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "session_id" TEXT,
    "search_query" TEXT,
    "filters" JSONB,
    "location" JSONB,
    "results_count" INTEGER,
    "clicked_profiles" JSONB,
    "deviceType" "DeviceType",
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER,

    CONSTRAINT "user_searches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "parent_id" TEXT,
    "icon_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_tags" (
    "profile_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_tags_pkey" PRIMARY KEY ("profile_id","tag_id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "deep_link" TEXT,
    "reference_id" TEXT,
    "reference_type" TEXT,
    "image_url" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "is_sent" BOOLEAN NOT NULL DEFAULT false,
    "send_email" BOOLEAN NOT NULL DEFAULT false,
    "send_push" BOOLEAN NOT NULL DEFAULT false,
    "send_sms" BOOLEAN NOT NULL DEFAULT false,
    "email_sent" BOOLEAN NOT NULL DEFAULT false,
    "push_sent" BOOLEAN NOT NULL DEFAULT false,
    "sms_sent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "importance" TEXT NOT NULL DEFAULT 'normal',

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_token" TEXT NOT NULL,
    "deviceType" "DeviceType" NOT NULL,
    "device_name" TEXT,
    "device_model" TEXT,
    "os_version" TEXT,
    "app_version" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "variables" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_reports" (
    "id" TEXT NOT NULL,
    "reporter_id" TEXT,
    "reported_user_id" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "description" TEXT,
    "evidence_urls" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pendiente',
    "resolved_by" TEXT,
    "resolution_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "user_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "ip_address" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faq_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faqs" (
    "id" TEXT NOT NULL,
    "category_id" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "excerpt" TEXT,
    "author_id" TEXT,
    "featured_image_url" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "category" TEXT,
    "tags" JSONB,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "views_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banners" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "mobile_image_url" TEXT,
    "link_url" TEXT,
    "display_location" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "target_audience" JSONB,
    "clicks_count" INTEGER NOT NULL DEFAULT 0,
    "views_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    "type" TEXT NOT NULL,
    "code" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'medium',
    "status" "TicketStatus" NOT NULL DEFAULT 'open',
    "assigned_to" TEXT,
    "category" TEXT,
    "related_entity_type" TEXT,
    "related_entity_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolution_notes" TEXT,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "attachments" JSONB,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "newsletters" BOOLEAN NOT NULL DEFAULT false,
    "promotions" BOOLEAN NOT NULL DEFAULT false,
    "system_notifications" BOOLEAN NOT NULL DEFAULT true,
    "chat_notifications" BOOLEAN NOT NULL DEFAULT true,
    "contact_notifications" BOOLEAN NOT NULL DEFAULT true,
    "payment_notifications" BOOLEAN NOT NULL DEFAULT true,
    "verification_notifications" BOOLEAN NOT NULL DEFAULT true,
    "unsubscribe_all" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "email_address" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "template_id" TEXT,
    "template_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'enviado',
    "error_message" TEXT,
    "email_provider" TEXT,
    "provider_message_id" TEXT,
    "opened" BOOLEAN NOT NULL DEFAULT false,
    "opened_at" TIMESTAMP(3),
    "clicked" BOOLEAN NOT NULL DEFAULT false,
    "clicked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_subscription_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "billing_interval" TEXT NOT NULL DEFAULT 'monthly',
    "max_profiles" INTEGER,
    "featured_profiles_included" INTEGER NOT NULL DEFAULT 0,
    "verification_credits" INTEGER NOT NULL DEFAULT 0,
    "commission_discount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "additional_benefits" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agency_subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_subscriptions" (
    "id" TEXT NOT NULL,
    "agency_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "auto_renew" BOOLEAN NOT NULL DEFAULT true,
    "payment_id" TEXT,
    "canceled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agency_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_commissions" (
    "id" TEXT NOT NULL,
    "agency_id" TEXT NOT NULL,
    "profile_id" TEXT,
    "commission_percentage" DECIMAL(65,30) NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "agency_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_payments" (
    "id" TEXT NOT NULL,
    "agency_id" TEXT NOT NULL,
    "profile_id" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "payment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" TEXT,
    "transaction_id" TEXT,
    "description" TEXT,
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "commission_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "previous_state" JSONB,
    "new_state" JSONB,
    "changes" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "external_auth_provider_provider_user_id_key" ON "external_auth"("provider", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_token_key" ON "user_sessions"("token");

-- CreateIndex
CREATE UNIQUE INDEX "clients_username_key" ON "clients"("username");

-- CreateIndex
CREATE UNIQUE INDEX "clients_referral_code_key" ON "clients"("referral_code");

-- CreateIndex
CREATE UNIQUE INDEX "agencies_slug_key" ON "agencies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_slug_key" ON "profiles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "user_coupons_code_key" ON "user_coupons"("code");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_client_id_profile_id_key" ON "conversations"("client_id", "profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_coupon_id_key" ON "payments"("coupon_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_payment_id_key" ON "invoices"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "raffle_entries_raffle_id_user_id_entry_number_key" ON "raffle_entries"("raffle_id", "user_id", "entry_number");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "user_devices_user_id_device_token_key" ON "user_devices"("user_id", "device_token");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "email_settings_user_id_key" ON "email_settings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- AddForeignKey
ALTER TABLE "external_auth" ADD CONSTRAINT "external_auth_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_id_fkey" FOREIGN KEY ("id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_referred_by_fkey" FOREIGN KEY ("referred_by") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agencies" ADD CONSTRAINT "agencies_id_fkey" FOREIGN KEY ("id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_images" ADD CONSTRAINT "profile_images_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_balance_history" ADD CONSTRAINT "point_balance_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_balance_history" ADD CONSTRAINT "point_balance_history_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "point_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_package_items" ADD CONSTRAINT "coupon_package_items_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "coupon_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_coupons" ADD CONSTRAINT "user_coupons_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_coupons" ADD CONSTRAINT "user_coupons_package_item_id_fkey" FOREIGN KEY ("package_item_id") REFERENCES "coupon_package_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_coupons" ADD CONSTRAINT "user_coupons_used_in_payment_fkey" FOREIGN KEY ("used_in_payment") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_coupons" ADD CONSTRAINT "user_coupons_transferred_to_fkey" FOREIGN KEY ("transferred_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_coupons" ADD CONSTRAINT "user_coupons_original_owner_fkey" FOREIGN KEY ("original_owner") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_contacts" ADD CONSTRAINT "profile_contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_contacts" ADD CONSTRAINT "profile_contacts_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_views" ADD CONSTRAINT "profile_views_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_methods_saved" ADD CONSTRAINT "payment_methods_saved_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods_saved"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "user_coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_status_history" ADD CONSTRAINT "payment_status_history_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_premium_services" ADD CONSTRAINT "user_premium_services_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_premium_services" ADD CONSTRAINT "user_premium_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "premium_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_premium_services" ADD CONSTRAINT "user_premium_services_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_premium_services" ADD CONSTRAINT "user_premium_services_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_vip_memberships" ADD CONSTRAINT "user_vip_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_vip_memberships" ADD CONSTRAINT "user_vip_memberships_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "vip_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_vip_memberships" ADD CONSTRAINT "user_vip_memberships_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_vip_memberships" ADD CONSTRAINT "user_vip_memberships_points_transaction_id_fkey" FOREIGN KEY ("points_transaction_id") REFERENCES "point_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raffle_entries" ADD CONSTRAINT "raffle_entries_raffle_id_fkey" FOREIGN KEY ("raffle_id") REFERENCES "raffles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raffle_entries" ADD CONSTRAINT "raffle_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raffle_entries" ADD CONSTRAINT "raffle_entries_points_transaction_id_fkey" FOREIGN KEY ("points_transaction_id") REFERENCES "point_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_changes" ADD CONSTRAINT "agency_changes_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_verifications" ADD CONSTRAINT "profile_verifications_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_verifications" ADD CONSTRAINT "profile_verifications_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_verifications" ADD CONSTRAINT "profile_verifications_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_verification_id_fkey" FOREIGN KEY ("verification_id") REFERENCES "profile_verifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_metrics" ADD CONSTRAINT "profile_metrics_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_tags" ADD CONSTRAINT "profile_tags_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_tags" ADD CONSTRAINT "profile_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "faq_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_settings" ADD CONSTRAINT "email_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_subscriptions" ADD CONSTRAINT "agency_subscriptions_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_subscriptions" ADD CONSTRAINT "agency_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "agency_subscription_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_subscriptions" ADD CONSTRAINT "agency_subscriptions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_commissions" ADD CONSTRAINT "agency_commissions_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_payments" ADD CONSTRAINT "commission_payments_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
