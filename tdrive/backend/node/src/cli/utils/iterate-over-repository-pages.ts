import { Pagination } from "../../core/platform/framework/api/crud-service";
import Repository, {
  FindFilter,
} from "../../core/platform/services/database/services/orm/repository/repository";
import { FindOptions } from "../../core/platform/services/search/api";

import waitTimeoutMS from "./wait-timeout";

const defaultPageSize = "100";

export default async function iterateOverRepositoryPages<Entity>(
  repository: Repository<Entity>,
  forEachPage: (entities: Entity[]) => Promise<void>,
  findOptions: FindOptions = {},
  filter: FindFilter = {},
  pageSizeAsStringForReasons: string = defaultPageSize,
  delayPerPageMS: number = 200,
) {
  let page: Pagination = { limitStr: pageSizeAsStringForReasons };
  do {
    const options = { ...findOptions, pagination: page };
    const list = await repository.find(filter, options, undefined);
    await forEachPage(list.getEntities());
    page = list.nextPage as Pagination;
    await waitTimeoutMS(delayPerPageMS);
  } while (page.page_token);
}
