const fileVersionSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    provider: { type: "string" },
    drive_item_id: { type: "string" },
    file_metadata: {
      type: "object",
      properties: {
        source: { type: "string" },
        external_id: { type: "string" },
        name: { type: "string" },
        mime: { type: "string" },
        size: { type: "string" },
        thumbnails: {
          type: "object",
          properties: {
            index: { type: "number" },
            id: { type: "string" },
            type: { type: "string" },
            size: { type: "number" },
            width: { type: "number" },
            height: { type: "number" },
            url: { type: "string" },
            full_url: { type: "string" },
          },
        },
      },
    },
    date_added: { type: "string" },
    creator_id: { type: "string" },
    application_id: { type: "string" },
    realname: { type: "string" },
    key: { type: "string" },
    mode: { type: "string" },
    file_size: { type: "number" },
    filename: { type: "string" },
    data: {},
  },
};

const documentSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    company_id: { type: "string" },
    parent_id: { type: "string" },
    is_in_trash: { type: "boolean" },
    is_directory: { type: "boolean" },
    name: { type: "string" },
    extension: { type: "string" },
    description: { type: "string" },
    tags: { type: "array" },
    added: { type: "string" },
    last_modified: { type: "string" },
    access_info: {
      type: "object",
      properties: {
        public: {
          type: "object",
          properties: {
            token: { type: "string" },
            password: { type: "string" },
            expiration: { type: "number" },
            level: { type: "string" },
          },
        },
        entities: { type: "array" },
      },
    },
    content_keywords: { type: "string" },
    hidden_data: {},
    root_group_folder: { type: "string" },
    creator: { type: "string" },
    size: { type: "number" },
    detached_file: { type: "boolean" },
    has_preview: { type: "boolean" },
    shared: { type: "boolean" },
    url: { type: "string" },
    preview_link: { type: "string" },
    object_link_cache: { type: "string" },
    external_storage: { type: "boolean" },
    last_user: { type: "string" },
    attachements: { type: "array" },
    last_version_cache: fileVersionSchema,
    scope: { type: "string" },
    av_status: { type: "string" },
  },
};

export const createDocumentSchema = {
  body: {
    type: "object",
    properties: {
      item: { type: "object" },
      version: { type: "object" },
    },
    required: ["item", "version"],
  },
  response: {
    "2xx": documentSchema,
  },
};

export const createVersionSchema = {
  body: {
    type: "object",
  },
  response: {
    "2xx": fileVersionSchema,
  },
};

export const beginEditingSchema = {
  body: {
    type: "object",
    properties: {
      editorApplicationId: { type: "string" },
      appInstanceId: { type: "string" },
    },
    required: ["editorApplicationId"],
  },
  response: {
    "2xx": {
      type: "object",
      properties: {
        editingSessionKey: { type: "string" },
      },
      required: ["editingSessionKey"],
    },
  },
};
