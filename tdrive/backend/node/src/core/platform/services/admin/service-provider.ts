import type User from "../../../../services/user/entities/user";
import type { TdriveServiceProvider } from "../../framework";

interface AdminServiceAPI extends TdriveServiceProvider {
  /**
   * Delete all data relative to provided user. Can be called repeatedly in case of timeout/intermittent s3, should get there.
   * @warn Irreversible, and no security checks
   */
  deleteUser(user: User): Promise<boolean>;
}

export default AdminServiceAPI;
