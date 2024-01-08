/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import _ from "lodash";
import { Connector } from "./connectors";
import { getEntityDefinition, unwrapPrimarykey } from "./utils";
import { v4 as uuidv4, v1 as uuidv1 } from "uuid";
import { logger } from "../../../../framework";
import { DatabaseEntitiesRemovedEvent, DatabaseEntitiesSavedEvent } from "./types";
import { localEventBus } from "../../../../framework/event-bus";

export default class EntityManager<EntityType extends Record<string, any>> {
  private toInsert: EntityType[] = [];
  private toUpdate: EntityType[] = [];
  private toRemove: EntityType[] = [];

  constructor(readonly connector: Connector) {}

  public persist(entity: any): this {
    if (!entity.constructor.prototype._entity || !entity.constructor.prototype._columns) {
      logger.error("Can not persist this object %o", entity);
      throw Error("Cannot persist this object: it is not an entity.");
    }

    // --- Generate ids on primary keys elements (if not defined) ---
    const { columnsDefinition, entityDefinition } = getEntityDefinition(entity);
    const primaryKey: string[] = unwrapPrimarykey(entityDefinition);

    function applyOnUpsert() {
      for (const column in columnsDefinition) {
        const definition = columnsDefinition[column];
        if (definition.options.onUpsert) {
          entity[definition.nodename] = definition.options.onUpsert(entity[definition.nodename]);
        }
      }
    }

    primaryKey.forEach(pk => {
      applyOnUpsert();
      if (entity[pk] === undefined) {
        const definition = columnsDefinition[pk];

        if (!definition) {
          throw Error(`There is no definition for primary key ${pk}`);
        }

        //Create default value
        switch (definition.options.generator || definition.type) {
          case "uuid":
            entity[pk] = uuidv4();
            break;
          case "timeuuid":
            entity[pk] = uuidv1();
            break;
          case "number":
            entity[pk] = 0;
            break;
          default:
            entity[pk] = "";
        }
        this.toInsert = this.toInsert.filter(e => e !== entity);
        this.toInsert.push(_.cloneDeep(entity));
      } else {
        this.toUpdate = this.toUpdate.filter(e => e !== entity);
        this.toUpdate.push(_.cloneDeep(entity));
      }
    });

    return this;
  }

  public remove(entity: EntityType, entityType?: EntityType): this {
    if (entityType) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      entity = _.merge(new (entityType as any)(), entity);
    }
    if (!entity.constructor.prototype._entity || !entity.constructor.prototype._columns) {
      throw Error("Cannot remove this object: it is not an entity.");
    }
    this.toRemove = this.toRemove.filter(e => e !== entity);
    this.toRemove.push(_.cloneDeep(entity));

    return this;
  }

  public async flush(): Promise<this> {
    this.toInsert = _.uniqWith(this.toInsert, _.isEqual);
    this.toUpdate = _.uniqWith(this.toUpdate, _.isEqual);
    this.toRemove = _.uniqWith(this.toRemove, _.isEqual);

    localEventBus.publish("database:entities:saved", {
      entities: this.toInsert.map(e => _.cloneDeep(e)),
    } as DatabaseEntitiesSavedEvent);

    localEventBus.publish("database:entities:saved", {
      entities: this.toUpdate.map(e => _.cloneDeep(e)),
    } as DatabaseEntitiesSavedEvent);

    localEventBus.publish("database:entities:saved", {
      entities: this.toRemove.map(e => _.cloneDeep(e)),
    } as DatabaseEntitiesRemovedEvent);

    await this.connector.upsert(this.toInsert, { action: "INSERT" });
    await this.connector.upsert(this.toUpdate, { action: "UPDATE" });
    await this.connector.remove(this.toRemove);

    return this;
  }

  public reset(): void {
    this.toInsert = [];
    this.toUpdate = [];
    this.toRemove = [];
  }
}
