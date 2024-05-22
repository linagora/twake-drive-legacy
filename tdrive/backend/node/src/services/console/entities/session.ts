import { merge } from "lodash";
import { Column, Entity } from "../../../core/platform/services/database/services/orm/decorators";

export const TYPE = "session";

//TODO here should be an index on sub, you are querying this after
@Entity(TYPE, {
  primaryKey: [["sub"]],
  type: TYPE,
})
export default class Session {
  //TODO add company id here as well, we should be multi-tenant, and sub could be not unique
  @Column("sub", "string")
  sub: string;

  @Column("sid", "string")
  sid: string;
}

export type UserSessionPrimaryKey = Pick<Session, "sub">;

export function getInstance(session: Partial<Session> & UserSessionPrimaryKey): Session {
  return merge(new Session(), session);
}
