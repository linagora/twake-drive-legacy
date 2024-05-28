# Database ORM platform service

## How to use it ?

A. Create an entity and put it anywhere in the code

```typescript
import {
  Entity,
  Column,
} from "../../../core/platform/services/database/services/orm/decorators";

@Entity("my_entity", {
  primaryKey: [["company_id"], "id"], //Primary key, see Cassandra documentation for more details
  type: "my_entity",
})
export class MyEntity {
  @Type(() => String)
  @Column("company_id", "uuid", { generator: "uuid" })
  company_id: string;

  @Column("workspace_id", { generator: "uuid" })
  id: string;

  @Column("text", "encoded")
  text: string;
}
```

B. Create a repository to manage entities

```typescript
const database: DatabaseServiceAPI = ...;
const repository = await database.getRepository("my_entity", MyEntity);

const newEntity = new MyEntity();
newEntity.company_id = "";
newEntity.text = "";
await repository.save(newEntity);

const entities = await repository.find({company_id: "", id: ""});
const entity = await repository.findOne({company_id: "", id: ""});

await repository.remove({company_id: "", id: ""});
```

## FAQ

#### I set a column to a type but I get an other type on code. Why for two identical definitions it created fields of different types?

It depends on what database you use (MongoDB or PostgreSQL) for development. Here is the process for each:

PostgreSQL:

- on startup it creates the tables with the requested types, in this case tdrive_boolean =&gt; boolean on PostgreSQL side
- on save entity it will convert the node type \(boolean\) to the good sql request: "{bool: false}" =&gt; "SET bool = false", it happens in the transformValueToDbString method
- on find entity it will convert the database raw value \(a boolean\) to the nodejs type \(boolean\)

Mongo:

- on startup it does nothing \(mongo don't need to initialise columns
- on save entity it will create a document, it means in mongo we just store json for each entity, there is no really a column concept.
- on find entity we just get back the saved json and map it to the entity in node.

  Even if mongo just store json directly from mongo, we sometime do some changes to the data before to save in mongo, it will also be in the typeTransforms.ts file.

So what could have happened in you case ?

- \(1\) if you use mongodb and we did not enforce the type before to save to mongo, then maybe you used a string instead of a boolean at some point in time while working and mongo just saved it as it was \(without checking the requested type on entity\)
- \(2\) other possibility is that we incorrectly get the information from the database on the typeTransforms.ts file, from PostgreSQL for instance I think we don't convert tinyint back to clean boolean, so you could get 0 and 1 instead of false and true. And maybe instead of 0 and 1 sometime undefined values can convert to ''.
- To fix all this just enforce the types in typeTransforms.ts for the tdrive_boolean type.
