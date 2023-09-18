import { DriveFile } from "../entities/drive-file";
import { DriveFileDTO } from "../web/dto/drive-file-dto";
import {
  ListResult,
  Paginable,
  Pagination,
} from "../../../core/platform/framework/api/crud-service";
import _ from "lodash";
import { CompanyExecutionContext } from "../types";
import User from "../../user/entities/user";
import { getSharedByUser } from "./access-check";
import globalResolver from "../../../services/global-resolver";

export class DriveFileDTOBuilder {
  static VIEW_SHARED_WITH_ME = "shared_with_me";

  private views: Map<string, string[]> = new Map([
    [
      "default",
      [
        "company_id",
        "id",
        "parent_id",
        "is_in_trash",
        "is_directory",
        "name",
        "extension",
        "description",
        "added",
        "last_modified",
        "size",
        "last_version_cache",
        "tags",
        "access_info",
        "content_keywords",
        "creator",
        "scope",
      ],
    ],
    [
      DriveFileDTOBuilder.VIEW_SHARED_WITH_ME,
      [
        "id",
        "name",
        "parent_id",
        "shared_by",
        "created_by",
        "is_directory",
        "extension",
        "added",
        "last_modified",
        "size",
        "last_version_cache",
      ],
    ],
  ]);

  public async build(
    files: ListResult<DriveFile>,
    context: CompanyExecutionContext,
    fields?: string[],
    view?: string,
  ): Promise<ListResult<DriveFileDTO>> {
    if (view) {
      fields = this.views.get(view);
    }
    if (!fields) {
      fields = this.views.get("default");
    }

    //if we need to fetch users, find all the user identifiers ask theirs data at once
    const fileUsers = new Map<string, FileUsers>();
    // gather all user identifiers who share files with the current user
    if (fields.some(f => f == "shared_by")) {
      files.getEntities().forEach(f => {
        fileUsers.set(f.id, { grantor: getSharedByUser(f.access_info, context) });
      });
    }
    // gather all users who created the files
    if (fields.some(f => f == "created_by")) {
      files.getEntities().forEach(f => {
        if (!fileUsers.has(f.id)) fileUsers.set(f.id, { creator: f.creator });
        else fileUsers.get(f.id).creator = f.creator;
      });
    }
    if (fileUsers.size > 0) {
      await this.initUserCash(fileUsers);
    }

    const nextPage: Paginable = new Pagination(files.page_token, files.nextPage?.limitStr);
    return new ListResult(
      "drive_files_dto",
      files.getEntities().map(f => this._buildDto(f, fields, fileUsers)),
      nextPage,
    );
  }

  private async initUserCash(fileUsers: Map<string, FileUsers>): Promise<void> {
    const ids = [] as string[];
    fileUsers.forEach(f => {
      if (f.creator) ids.push(f.creator);
      if (f.grantor) ids.push(f.grantor);
    });

    const users = await this.fetchUsers(ids);
    const userById = new Map(users.map(u => [u.id, u]));
    fileUsers.forEach(f => {
      f.creatorObj = userById.get(f.creator);
      f.grantorObj = userById.get(f.grantor);
    });
  }

  async fetchUsers(ids: string[]) {
    ids.filter(id => id != null);
    return (
      await globalResolver.services.users.list(
        {
          limitStr: ids.length.toString(),
        } as Pagination,
        { userIds: _.uniq(ids) },
      )
    ).getEntities();
  }

  private _buildDto(file: DriveFile, fields: string[], userCache: Map<string, FileUsers>) {
    const dto = _.pick(file, fields) as DriveFileDTO;
    const users = userCache.get(file.id);
    if (users) {
      dto.created_by = users?.creatorObj;
      dto.shared_by = users?.grantorObj;
    }
    return dto;
  }
}

type FileUsers = {
  creator?: string;
  grantor?: string;
  creatorObj?: User;
  grantorObj?: User;
};
