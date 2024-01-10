import { Column, Entity } from "../../../../../../../../../src/core/platform/services/database/services/orm/decorators";
import { Type } from "class-transformer";

export const normalizeWhitespace = (query: string) => query.replace(/\s+/g, ' ').trim();

@Entity("test_table", {
  globalIndexes: [
    ["company_id", "parent_id"],
    ["company_id", "is_in_trash"],
  ],
  primaryKey: [["company_id"], "id"],
  type: "test_table",
})
// @ts-ignore
export class TestDbEntity {

  @Type(() => String)
  @Column("company_id", "uuid")
    // @ts-ignore
  company_id: string;

  @Type(() => String)
  @Column("id", "uuid", { generator: "uuid" })
    // @ts-ignore
  id: string;

  @Type(() => String)
  @Column("parent_id", "uuid")
    // @ts-ignore
  parent_id: string;

  @Type(() => Boolean)
  @Column("is_in_trash", "boolean")
    // @ts-ignore
  is_in_trash: boolean;

  @Column("tags", "encoded_json")
    // @ts-ignore
  tags: string[];

  @Type(() => Number)
  @Column("added", "number")
    // @ts-ignore
  added: number;

  public constructor(init?:Partial<TestDbEntity>) {
    Object.assign(this, init);
  }

}