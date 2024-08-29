import { DriveFile, TYPE } from "./drive-file";

export default {
  index: TYPE,
  source: (entity: DriveFile) => ({
    content_keywords: entity.content_keywords,
    tags: (entity.tags || []).join(" "),
    creator: entity.creator,
    added: entity.added,
    name: entity.name,
    //especially for ES because it doesn't allow to sort by not a keyword fields
    name_keyword: entity.name,
    company_id: entity.company_id,
    access_entities: entity.access_info?.entities?.filter(e => e.level != "none").map(e => e.id),
    last_modified: entity.last_modified,
    mime_type: entity.last_version_cache?.file_metadata?.mime,
    size: entity.last_version_cache?.file_metadata?.size,
  }),
  mongoMapping: {
    text: {
      content_keywords: "text",
      tags: "text",
      creator: "text",
      name: "text",
      name_keyword: "text",
      company_id: "text",
      mime_type: "text",
    },
  },
  esMapping: {
    properties: {
      name: { type: "text", index_prefixes: { min_chars: 1 } },
      name_keyword: { type: "keyword" },
      content_keywords: { type: "text", index_prefixes: { min_chars: 1 } },
      tags: { type: "keyword" },
      creator: { type: "keyword" },
      added: { type: "unsigned_long" },
      company_id: { type: "keyword" },
      access_entities: { type: "keyword" },
      mime_type: { type: "keyword" },
      last_modified: { type: "unsigned_long" },
    },
  },
};
