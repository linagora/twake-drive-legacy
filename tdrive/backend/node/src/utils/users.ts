import User from "../services/user/entities/user";
import {
  CompanyShort,
  CompanyUserObject,
  CompanyUserRole,
  CompanyUserStatus,
  UserObject,
} from "../services/user/web/types";
import { Configuration } from "../core/platform/framework";
import gr from "../services/global-resolver";

export async function formatUser(
  user: User,
  options?: { includeCompanies?: boolean },
): Promise<UserObject> {
  if (!user) return null;
  const configuration = new Configuration("drive");
  const defaultLang = configuration.get<string>("defaultLanguage") || "en";

  let resUser = {
    id: user.id,
    provider: user.identity_provider,
    provider_id: user.identity_provider_id,
    email: user.email_canonical,
    username: user.username_canonical,
    is_verified: Boolean(user.mail_verified),
    picture: user.picture,
    first_name: user.first_name,
    last_name: user.last_name,
    full_name: [user.first_name, user.last_name].join(" "),
    created_at: user.creation_date,
    deleted: Boolean(user.deleted),
    delete_process_started_epoch: user.delete_process_started_epoch,
    status: user.status_icon,
    last_activity: user.last_activity,
    cache: { companies: user.cache?.companies || [] },
  } as UserObject;

  if (options?.includeCompanies) {
    const userCompanies = await gr.services.users.getUserCompanies({ id: user.id });

    const companies = await Promise.all(
      userCompanies.map(async uc => {
        const company = await gr.services.companies.getCompany({ id: uc.group_id });
        if (!company) {
          throw new Error(`Company with id ${uc.group_id} doesn't exists!`);
        }
        return {
          role: uc.role as CompanyUserRole,
          status: "active" as CompanyUserStatus, // FIXME: with real status
          company: {
            id: uc.group_id,
            name: company.name,
            logo: company.logo,
          } as CompanyShort,
        } as CompanyUserObject;
      }),
    );

    resUser = {
      ...resUser,
      preferences: {
        ...user.preferences,
        locale: user.preferences?.language || user.language || defaultLang,
        timezone: user.preferences?.timezone || parseInt(user.timezone) || 0,
        allow_tracking: user.preferences?.allow_tracking || false,
      },

      companies,
    };

    // Fixme: this is for retro compatibility, should be deleted after march 2022 if mobile did implement it https://github.com/linagora/Tdrive-Mobile/issues/1265
    resUser.preference = resUser.preferences;

    let name: string = resUser?.username;
    if (!name) {
      resUser.full_name = "Anonymous";
    } else {
      if (resUser.deleted) {
        name = "Deleted user";
      } else {
        name = [resUser.first_name, resUser.last_name].filter(a => a).join(" ");
        name = name || resUser.username;
      }
      resUser.full_name = name.charAt(0).toUpperCase() + name.slice(1);
    }
  }

  return resUser;
}

export function formatUsername(value: string) {
  return (value?.replace(/[^a-z0-9_-]/, "") || "").toLocaleLowerCase();
}
