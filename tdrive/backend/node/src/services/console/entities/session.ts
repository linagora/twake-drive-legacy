import { merge } from "lodash";
import { Column, Entity } from "../../../core/platform/services/database/services/orm/decorators";

export const TYPE = "session";

@Entity(TYPE, {
  primaryKey: [["company_id"], "sid"],
  globalIndexes: [["sid"], ["revoked_at"]],
  type: TYPE,
})
export default class Session {
  @Column("company_id", "uuid")
  company_id: string;

  @Column("sub", "string")
  sub: string;

  @Column("sid", "string")
  sid: string;

  @Column("revoked_at", "number")
  revoked_at: number;
}

export type UserSessionPrimaryKey = Pick<Session, "sid">;

export function getInstance(session: Partial<Session> & UserSessionPrimaryKey): Session {
  return merge(new Session(), session);
}
