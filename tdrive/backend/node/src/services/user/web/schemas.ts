import { webSocketSchema } from "../../../utils/types";
import { CompanyFeaturesEnum, CompanyLimitsEnum } from "./types";

export const userObjectSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    provider: { type: "string" },
    provider_id: { type: "string" },

    email: { type: "string" },
    username: { type: "string" },
    is_verified: { type: "boolean" },
    picture: { type: "string" },
    first_name: { type: "string" },
    last_name: { type: "string" },
    created_at: { type: "number" },
    deleted: { type: "boolean" },

    status: { type: "string" },
    last_activity: { type: "number" },

    // cache: { type: ["object", "null"] },
    cache: {
      type: "object",
      properties: {
        companies: { type: ["array", "null"] },
      },
    },

    //Below is only if this is myself
    preferences: {
      type: "object",
      properties: {
        tutorial_done: { type: ["boolean", "null"] },
        channel_ordering: { type: ["string", "null"] },
        recent_workspaces: { type: ["array", "null"] },
        knowledge_graph: { type: ["string", "null"] },
        locale: { type: ["string", "null"] },
        timezone: { type: ["number", "null"] },
        language: { type: ["string", "null"] },
        allow_tracking: { type: ["boolean", "null"] },
      },
    },
    companies: {
      type: "array",
      items: {
        type: "object",
        properties: {
          role: { type: "string", enum: ["owner", "admin", "member", "guest"] },
          status: { type: "string", enum: ["owner", "deactivated", "invited"] },
          company: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              logo: { type: "string" },
            },
          },
        },
      },
    },
    // TODO this is temporary, should be deleted
    preference: {},
  },
};

export const companyObjectSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    logo: { type: "string" },
    plan: {
      type: ["object", "null"],
      properties: {
        name: { type: "string" },
        limits: {
          type: ["object", "null"],
          properties: {
            [CompanyLimitsEnum.CHAT_MESSAGE_HISTORY_LIMIT]: { type: "number" },
            [CompanyLimitsEnum.COMPANY_MEMBERS_LIMIT]: { type: "number" },
            [CompanyLimitsEnum.COMPANY_GUESTS_LIMIT]: { type: "number" },
          },
        },
        features: {
          type: "object",
          properties: {
            [CompanyFeaturesEnum.CHAT_EDIT_FILES]: { type: ["boolean"] },
            [CompanyFeaturesEnum.CHAT_GUESTS]: { type: ["boolean"] },
            [CompanyFeaturesEnum.CHAT_MESSAGE_HISTORY]: { type: "boolean" },
            [CompanyFeaturesEnum.CHAT_MULTIPLE_WORKSPACES]: { type: "boolean" },
            [CompanyFeaturesEnum.CHAT_UNLIMITED_STORAGE]: { type: "boolean" },
            [CompanyFeaturesEnum.COMPANY_INVITE_MEMBER]: { type: "boolean" },
            [CompanyFeaturesEnum.COMPANY_SEARCH_USERS]: { type: "boolean" },
            [CompanyFeaturesEnum.COMPANY_SHARED_DRIVE]: { type: "boolean" },
            [CompanyFeaturesEnum.COMPANY_DISPLAY_EMAIL]: { type: "boolean" },
            [CompanyFeaturesEnum.COMPANY_USER_QUOTA]: { type: "boolean" },
            guests: { type: "number" }, // to rename or delete
            members: { type: "number" }, //  to rename or delete
            storage: { type: "number" }, //  to rename or delete
          },
          required: [] as string[],
        },
      },
    },
    stats: {
      type: ["object", "null"],
      properties: {
        created_at: { type: "number" },
        total_members: { type: "number" },
        total_guests: { type: "number" },
        total_messages: { type: "number" },
      },
    },
    identity_provider_id: { type: "string" },
    identity_provider: { type: "string" },
    role: { type: "string", enum: ["owner", "admin", "member", "guest"] },
    status: { type: "string", enum: ["owner", "deactivated", "invited"] },
  },
};

export const getUserSchema = {
  response: {
    "2xx": {
      type: "object",
      properties: {
        resource: userObjectSchema,
        websocket: webSocketSchema,
      },
      required: ["resource"],
    },
  },
  tags: ["User"],
  params: {
    type: "object",
    description: "Users",
    properties: {
      id: {
        description: "User ID",
        type: "string",
      },
    },
  },
};

export const getQuotaSchema = {
  type: "object",
  properties: {
    companyId: { type: "string" },
  },
  response: {
    "2xx": {
      type: "object",
      properties: {
        used: { type: "number" },
        remaining: { type: "number" },
        total: { type: "number" },
      },
    },
  },
  tags: ["User"],
  params: {
    type: "object",
    description: "Users",
    properties: {
      id: {
        description: "User ID",
        type: "string",
      },
    },
  },
};

export const setUserPreferencesSchema = {
  request: {
    properties: {
      tutorial_done: { type: ["boolean", "null"] },
      channel_ordering: { type: ["string", "null"] },
      recent_workspaces: { type: ["array", "null"] },
      knowledge_graph: { type: ["string", "null"] },
      locale: { type: ["string", "null"] },
      timezone: { type: ["number", "null"] },
      language: { type: ["string", "null"] },
      allow_tracking: { type: ["boolean", "null"] },
    },
    required: [] as any[],
  },
  tags: ["User"],
  response: {
    "2xx": userObjectSchema.properties.preferences,
  },
};

export const getUsersSchema = {
  type: "object",
  properties: {
    user_ids: { type: "string" },
    include_companies: { type: "boolean" },
  },
  response: {
    "2xx": {
      type: "object",
      properties: {
        resources: { type: "array", items: userObjectSchema },
      },
      required: ["resources"],
    },
  },
};

//Not used because it causes issues with the features json object
export const getUserCompaniesSchema = {
  type: "object",
  response: {
    "2xx": {
      type: "object",
      properties: {
        resources: { type: "array", items: companyObjectSchema },
      },
      required: ["resources"],
    },
  },
};

//Not used because it causes issues with the features json object
export const getCompanySchema = {
  type: "object",
  response: {
    "2xx": {
      type: "object",
      properties: {
        resource: companyObjectSchema,
        websocket: webSocketSchema,
      },
      required: ["resource"],
    },
  },
};

const deviceSchema = {
  type: "object",
  properties: {
    type: { type: "string" },
    value: { type: "string" },
    version: { type: "string" },
  },
  required: ["type", "value", "version"],
};

export const postDevicesSchema = {
  type: "object",
  body: {
    type: "object",
    properties: {
      resource: deviceSchema,
    },
  },
  required: ["resource"],
  response: {
    "2xx": {
      type: "object",
      properties: {
        resource: deviceSchema,
      },
      required: ["resource"],
    },
  },
};

export const getDevicesSchema = {
  response: {
    "2xx": {
      type: "object",
      properties: {
        resources: { type: "array", items: deviceSchema },
      },
    },
  },
};

export const deleteDeviceSchema = {
  response: {
    "2xx": {
      type: "object",
      properties: {
        success: { type: "boolean" },
      },
    },
  },
};
