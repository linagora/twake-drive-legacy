import { merge } from "lodash";
import { Column, Entity } from "../../../core/platform/services/database/services/orm/decorators";

export const TYPE = "session";

@Entity(TYPE, {
  primaryKey: [["sub"]],
  type: TYPE,
})
export default class Session {
  @Column("sub", "string")
  sub: string;

  @Column("sid", "string")
  sid: string;
}

export type UserSessionPrimaryKey = Pick<Session, "sub">;

export function getInstance(userDevice: Partial<Session> & UserSessionPrimaryKey): Session {
  return merge(new Session(), userDevice);
}
