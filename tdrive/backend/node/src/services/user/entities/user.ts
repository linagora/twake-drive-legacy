import { isNumber, merge } from "lodash";
import { Column, Entity } from "../../../core/platform/services/database/services/orm/decorators";
import search from "./user.search";
import { uuid } from "../../../utils/types";

export const TYPE = "user";
export type UserType = "anonymous" | "tech" | "regular";

@Entity(TYPE, {
  primaryKey: [["id"]],
  globalIndexes: [["email_canonical"], ["username_canonical"]],
  type: TYPE,
  search,
})
export default class User {
  @Column("id", "timeuuid")
  id: uuid;

  @Column("first_name", "encoded_string")
  first_name: string;

  @Column("last_name", "encoded_string")
  last_name: string;

  @Column("picture", "encoded_string")
  picture: string;

  @Column("status_icon", "string")
  private _status_icon: string; // = '["", ""]';

  public get status_icon(): string {
    if (this._status_icon && this._status_icon.startsWith("[\\")) {
      try {
        // eslint-disable-next-line quotes
        const parsed = JSON.parse(this._status_icon.replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
        return `${parsed[0]} ${parsed[1]}`;
      } catch (e) {
        return "";
      }
    }
    return this._status_icon;
  }

  public set status_icon(status: string) {
    this._status_icon = status;
  }

  @Column("last_activity", "number")
  last_activity: number;

  @Column("creation_date", "tdrive_datetime")
  creation_date: number;

  @Column("notification_preference", "encoded_json")
  // FIXME= Which type to use with encoded json? This is an object at the end
  notification_preference: any;

  @Column("identity_provider", "encoded_string")
  identity_provider: string;

  @Column("identity_provider_id", "encoded_string")
  identity_provider_id: string;

  @Column("token_login", "encoded_string")
  token_login: string;

  // TODO: Index
  @Column("username_canonical", "string")
  username_canonical: string;

  // TODO: Index
  @Column("email_canonical", "string")
  email_canonical: string;

  @Column("password", "string")
  password: string;

  @Column("deleted", "tdrive_boolean")
  deleted: boolean;

  /**
   * If set, a restartable suppression process is currently incomplete.
   */
  @Column("delete_process_started_epoch", "number")
  delete_process_started_epoch?: number;

  @Column("mail_verified", "tdrive_boolean")
  mail_verified: boolean;

  @Column("phone", "string")
  phone: string;

  @Column("thumbnail_id", "timeuuid")
  thumbnail_id: string;

  @Column("language", "string")
  language: string; //Depreciated (php legacy)

  @Column("timezone", "string")
  timezone: string; //Depreciated (php legacy)

  @Column("type", "string")
  type: UserType;

  @Column("preferences", "encoded_json")
  preferences: null | {
    locale?: string;
    timezone?: number;
    language?: string;
    allow_tracking?: boolean;
    tutorial_done?: boolean;
    channel_ordering?: "chronological" | "alphabetical";
    recent_workspaces?: { company_id: string; workspace_id: string }[];
    knowledge_graph?: "all" | "nothing" | "metadata";
    notifications?: UserNotificationPreferences[];
  };

  @Column("cache", "encoded_json")
  cache: null | {
    companies: string[];
  };

  @Column("devices", "encoded_json")
  devices: Array<string>;

  @Column("salt", "string")
  salt: string;

  constructor(id?: string) {
    this.id = id;
  }
}

export type UserNotificationPreferences = {
  company_id: string | "all";
  workspace_id: string | "all";
  preferences: {
    highlight_words?: string[];
    night_break?: {
      enable: boolean;
      from: number;
      to: number;
    };
    private_message_content?: boolean;
    mobile_notifications?: "never" | "when_inactive" | "always";
    email_notifications_delay?: number; //0: never send email, 1 and more in minutes from first unread notification
    deactivate_notifications_until?: number;
    notification_sound?: "default" | "none" | string;
  };
};

export type UserPrimaryKey = Pick<User, "id">;

export function getInstance(user: Partial<User>): User {
  user.creation_date = !isNumber(user.creation_date) ? Date.now() : user.creation_date;
  return merge(new User(), user);
}
