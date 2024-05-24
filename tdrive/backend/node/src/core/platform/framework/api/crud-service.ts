import { User } from "../../../../utils/types";

export class ContextualizedTarget {
  context?: ExecutionContext;
  readonly operation: OperationType;
}

export class EntityTarget<Entity> extends ContextualizedTarget {
  /**
   *
   * @param type type of entity
   * @param entity the entity itself
   */
  constructor(readonly type: string, readonly entity: Entity) {
    super();
  }
}

export class UpdateResult<Entity> extends EntityTarget<Entity> {
  readonly operation = OperationType.UPDATE;

  /**
   * Result sent back by the underlying database
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw?: any;

  /**
   * Number of rows affected by the update.
   */
  affected?: number;
}

export class CreateResult<Entity> extends EntityTarget<Entity> {
  readonly operation = OperationType.CREATE;

  /**
   * Result sent back by the underlying database
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw?: any;
}

export class SaveResult<Entity> extends EntityTarget<Entity> {
  /**
   * Result sent back by the underlying database
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw?: any;

  /**
   *
   * @param type Type of entity
   * @param entity The entity itself
   * @param operation Save can be for a "create", an "update" or "exists" when resource already exists
   */
  constructor(
    readonly type: string,
    readonly entity: Entity,
    readonly operation: OperationType.UPDATE | OperationType.CREATE | OperationType.EXISTS,
  ) {
    super(type, entity);
  }
}

export class DeleteResult<Entity> extends EntityTarget<Entity> {
  readonly operation = OperationType.DELETE;

  /**
   *
   * @param type type of entity
   * @param entity the entity itself
   * @param deleted the entity has been deleted or not
   */
  constructor(readonly type: string, readonly entity: Entity, readonly deleted: boolean) {
    super(type, entity);
  }
}

export class ListResult<Entity> extends ContextualizedTarget implements Paginable {
  // next page token
  page_token: string;

  constructor(readonly type: string, protected entities: Entity[], readonly nextPage?: Paginable) {
    super();
    this.page_token = nextPage?.page_token;
  }

  mapEntities(mapper: <T extends Entity>(entity: Entity) => T): void {
    this.entities = this.entities.map(entity => mapper(entity));
  }

  filterEntities(filter: (entity: Entity) => boolean): void {
    this.entities = this.entities.filter(entity => filter(entity));
  }

  getEntities(): Entity[] {
    return this.entities || [];
  }

  isEmpty(): boolean {
    return this.getEntities().length === 0;
  }
}

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  SAVE = "save",
  DELETE = "delete",
  EXISTS = "exists",
}

export declare type EntityOperationResult<Entity> =
  | CreateResult<Entity>
  | UpdateResult<Entity>
  | SaveResult<Entity>
  | DeleteResult<Entity>;

export interface ExecutionContext {
  user: User;
  reqId?: string;
  url?: string;
  method?: string;
  transport?: "http" | "ws";
}

export class CrudException extends Error {
  constructor(readonly details: string, readonly status: number) {
    super();
    this.message = details;
  }

  static badRequest(details: string): CrudException {
    return new CrudException(details, 400);
  }

  static unauthorized(details: string): CrudException {
    return new CrudException(details, 401);
  }

  static notFound(details: string): CrudException {
    return new CrudException(details, 404);
  }
  static forbidden(details: string): CrudException {
    return new CrudException(details, 403);
  }

  static notImplemented(details: string): CrudException {
    return new CrudException(details, 501);
  }

  static badGateway(details: string): CrudException {
    return new CrudException(details, 502);
  }

  static throwMe(cause: Error, newOne: CrudException): void {
    throw cause instanceof CrudException ? cause : newOne;
  }
}

export interface Paginable {
  page_token?: string;
  limitStr?: string;
  reversed?: boolean;
}

export class Pagination implements Paginable {
  reversed?: boolean;
  constructor(readonly page_token?: string, readonly limitStr = "100", reversed = false) {
    this.reversed = reversed;
  }

  public static fromPaginable(p: Paginable) {
    return new Pagination(p.page_token, p.limitStr, p.reversed);
  }
}

export interface CRUDService<Entity, PrimaryKey, Context extends ExecutionContext> {
  /**
   * Creates a resource
   *
   * @param item
   * @param context
   */
  create?(item: Entity, context?: Context): Promise<CreateResult<Entity>>;

  /**
   * Get a resource
   *
   * @param pk
   * @param context
   */
  get(pk: PrimaryKey, context?: Context): Promise<Entity>;

  /**
   * Update a resource
   *
   * @param pk
   * @param item
   * @param context
   */
  update?(
    pk: PrimaryKey,
    item: Entity,
    context?: Context /* TODO: Options */,
  ): Promise<UpdateResult<Entity>>;

  /**
   * Save a resource.
   * If the resource exists, it is updated, if it does not exists, it is created.
   *
   * @param item
   * @param options
   * @param context
   */
  save?<SaveOptions>(
    item: Entity,
    options?: SaveOptions,
    context?: Context,
  ): Promise<SaveResult<Entity>>;

  /**
   * Delete a resource
   *
   * @param pk
   * @param context
   */
  delete(pk: PrimaryKey, context?: Context): Promise<DeleteResult<Entity>>;

  /**
   * List a resource
   *
   * @param pagination
   * @param options
   * @param context
   */
  list<ListOptions>(
    pagination: Paginable,
    options?: ListOptions,
    context?: Context /* TODO: Options */,
  ): Promise<ListResult<Entity>>;
}
