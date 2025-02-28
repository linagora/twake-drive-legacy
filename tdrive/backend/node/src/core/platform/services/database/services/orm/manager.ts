/* eslint-disable @typescript-eslint/no-explicit-any */
import _ from "lodash";
import { Connector } from "./connectors";
import { getEntityDefinition, unwrapPrimarykey } from "./utils";
import { v4 as uuidv4, v1 as uuidv1 } from "uuid";
import { logger } from "../../../../framework";
import { DatabaseEntitiesRemovedEvent, DatabaseEntitiesSavedEvent } from "./types";
import { localEventBus } from "../../../../framework/event-bus";

export default class EntityManager<EntityType extends Record<string, any>> {
  constructor(readonly connector: Connector) {}

  public async persist(entity: any): Promise<this> {
    logger.trace(
      `services.database.orm.entity-manager.persist - entity: ${JSON.stringify(entity)}`,
    );
    if (!entity.constructor.prototype._entity || !entity.constructor.prototype._columns) {
      logger.error("Can not persist this object %o", entity);
      throw Error("Cannot persist this object: it is not an entity.");
    }

    // --- Generate ids on primary keys elements (if not defined) ---
    const { columnsDefinition, entityDefinition } = getEntityDefinition(entity);
    const primaryKey: string[] = unwrapPrimarykey(entityDefinition);

    //apply on upsert(generating created_at, updated_at fields)
    for (const column in columnsDefinition) {
      const definition = columnsDefinition[column];
      if (definition.options.onUpsert) {
        entity[definition.nodename] = definition.options.onUpsert(entity[definition.nodename]);
      }
    }

    // generate primary key
    const emptyPkFields = primaryKey.filter(
      pk => entity[columnsDefinition[pk].nodename] === undefined,
    );
    emptyPkFields.forEach(pk => {
      const definition = columnsDefinition[pk];

      if (!definition) {
        throw Error(`There is no definition for primary key ${pk}`);
      }
      //Create default value
      switch (definition.options.generator || definition.type) {
        case "uuid":
          entity[columnsDefinition[pk].nodename] = uuidv4();
          break;
        case "timeuuid":
          entity[columnsDefinition[pk].nodename] = uuidv1();
          break;
        case "number":
          entity[columnsDefinition[pk].nodename] = 0;
          break;
        default:
          entity[columnsDefinition[pk].nodename] = "";
      }
    });

    entity = _.cloneDeep(entity);
    if (emptyPkFields.length > 0) {
      await this.connector.upsert([entity], { action: "INSERT" });
    } else {
      await this.connector.upsert([entity], { action: "UPDATE" });
    }
    localEventBus.publish("database:entities:saved", {
      entities: [entity],
    } as DatabaseEntitiesSavedEvent);

    return this;
  }

  public async remove(entity: EntityType, entityType?: EntityType): Promise<this> {
    if (entityType) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      entity = _.merge(new (entityType as any)(), entity);
    }
    if (!entity.constructor.prototype._entity || !entity.constructor.prototype._columns) {
      throw Error("Cannot remove this object: it is not an entity.");
    }

    await this.connector.remove([entity]);

    localEventBus.publish("database:entities:removed", {
      entities: [entity],
    } as DatabaseEntitiesRemovedEvent);

    return this;
  }
}
