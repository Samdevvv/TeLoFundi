import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger";
import slugify from "slugify";
import crypto from "crypto";
import {
  Agency,
  AgencyProfileFilters,
  AgencyProfilesResponse,
  VerificationData,
  AgencyChangeRequest,
  AgencyServiceResponse,
} from "../types/agency.types";
import { Profile } from "../types/profile.types";

const prisma = new PrismaClient();

class AgencyService {
  /**
   * Obtiene una agencia por su ID
   */
  async getAgencyById(
    agencyId: string,
    includeProfiles: boolean = false
  ): Promise<AgencyServiceResponse<Agency>> {
    try {
      const select = {
        id: true,
        name: true,
        slug: true,
        description: true,
        shortDescription: true,
        website: true,
        address: true,
        city: true,
        stateProvince: true,
        country: true,
        postalCode: true,
        verificationStatus: true,
        verifiedAt: true,
        logoUrl: true,
        coverImageUrl: true,
        galleryImages: true,
        socialMedia: true,
        businessHours: true,
        commissionRate: true,
        subscriptionTier: true,
        subscriptionExpires: true,
        paymentMethods: true,
        contactPhone: true,
        contactEmail: true,
        contactWhatsapp: true,
        totalProfiles: true,
        activeProfiles: true,
        verifiedProfiles: true,
        rating: true,
        totalRatings: true,
        featuredUntil: true,
        establishmentYear: true,
        isExclusive: true,
        user: {
          select: {
            id: true,
            lastLogin: true,
            createdAt: true,
          },
        },
      };

      if (includeProfiles) {
        select["profiles"] = {
          where: {
            isActive: true,
            hidden: false,
          },
          select: {
            id: true,
            displayName: true,
            slug: true,
            gender: true,
            age: true,
            shortDescription: true,
            verificationStatus: true,
            nationality: true,
            location: true,
            priceHour: true,
            currency: true,
            availabilityStatus: true,
            isFeatured: true,
            user: {
              select: {
                profileImageUrl: true,
              },
            },
            profileImages: {
              where: {
                isApproved: true,
                isPublic: true,
                isMain: true,
              },
              select: {
                thumbnailUrl: true,
                blurHash: true,
              },
              take: 1,
            },
          },
          orderBy: [
            { isFeatured: "desc" },
            { verificationStatus: "asc" },
            { lastActivity: "desc" },
          ],
          take: 100,
        };
      }

      const agency = await prisma.agency.findUnique({
        where: { id: agencyId },
        select,
      });

      if (!agency) {
        return {
          success: false,
          error: "Agencia no encontrada",
        };
      }

      return {
        success: true,
        data: agency as Agency,
      };
    } catch (error) {
      logger.error(`Error al obtener agencia: ${error.message}`, { error });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Obtiene una agencia por su slug
   */
  async getAgencyBySlug(
    slug: string,
    includeProfiles: boolean = false
  ): Promise<AgencyServiceResponse<Agency>> {
    try {
      const agency = await prisma.agency.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!agency) {
        return {
          success: false,
          error: "Agencia no encontrada",
        };
      }

      return this.getAgencyById(agency.id, includeProfiles);
    } catch (error) {
      logger.error(`Error al obtener agencia por slug: ${error.message}`, {
        error,
      });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Actualiza una agencia
   */
  async updateAgency(
    agencyId: string,
    agencyData: Partial<Agency>
  ): Promise<AgencyServiceResponse<Agency>> {
    try {
      if (agencyData.name) {
        agencyData.slug = this.generateSlug(agencyData.name);
      }

      const updatedAgency = await prisma.agency.update({
        where: { id: agencyId },
        data: agencyData,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          shortDescription: true,
        },
      });

      return {
        success: true,
        data: updatedAgency as Agency,
      };
    } catch (error) {
      logger.error(`Error al actualizar agencia: ${error.message}`, { error });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Obtiene los perfiles de una agencia
   */
  async getAgencyProfiles(
    agencyId: string,
    options: AgencyProfileFilters = {}
  ): Promise<AgencyServiceResponse<AgencyProfilesResponse>> {
    try {
      const {
        page = 1,
        limit = 20,
        gender,
        minAge,
        maxAge,
        services,
        verificationStatus,
        availabilityStatus,
        orderBy = "featured",
      } = options;

      const skip = (page - 1) * limit;

      const where: any = {
        agencyId,
        isActive: true,
        hidden: false,
      };

      if (gender) where.gender = gender;
      if (minAge) where.age = { ...where.age, gte: parseInt(String(minAge)) };
      if (maxAge) where.age = { ...where.age, lte: parseInt(String(maxAge)) };
      if (verificationStatus) where.verificationStatus = verificationStatus;
      if (availabilityStatus) where.availabilityStatus = availabilityStatus;
      if (services?.length) {
        where.services = {
          path: services.map((service) => `$.${service}`),
          equals: true,
        };
      }

      let orderByClause: any;
      switch (orderBy) {
        case "recent":
          orderByClause = { lastActivity: "desc" };
          break;
        case "price_asc":
          orderByClause = { priceHour: "asc" };
          break;
        case "price_desc":
          orderByClause = { priceHour: "desc" };
          break;
        case "featured":
        default:
          orderByClause = [
            { isFeatured: "desc" },
            { verificationStatus: "asc" },
            { lastActivity: "desc" },
          ];
      }

      const profiles = await prisma.profile.findMany({
        where,
        select: {
          id: true,
          displayName: true,
          slug: true,
          gender: true,
          age: true,
          shortDescription: true,
          verificationStatus: true,
          nationality: true,
          location: true,
          priceHour: true,
          currency: true,
          availabilityStatus: true,
          isFeatured: true,
          lastActivity: true,
          user: {
            select: {
              profileImageUrl: true,
            },
          },
          profileImages: {
            where: {
              isApproved: true,
              isPublic: true,
              isMain: true,
            },
            select: {
              thumbnailUrl: true,
              blurHash: true,
            },
            take: 1,
          },
        },
        orderBy: orderByClause,
        skip,
        take: limit,
      });

      const total = await prisma.profile.count({ where });

      return {
        success: true,
        data: {
          profiles: profiles as Profile[],
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error(`Error al obtener perfiles de agencia: ${error.message}`, {
        error,
      });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Genera un slug a partir de un texto
   */
  private generateSlug(text: string): string {
    const slug = slugify(text, {
      lower: true,
      strict: true,
      trim: true,
    });

    const randomSuffix = crypto.randomBytes(3).toString("hex");
    return `${slug}-${randomSuffix}`;
  }

  // ... Resto de métodos con sus tipos correspondientes
}

export default new AgencyService();
