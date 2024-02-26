import { TestPlatform, User } from "./setup";
import { InjectPayload, Response } from "light-my-request";
import { logger as log } from "../../src/core/platform/framework";

declare global {
  interface ApiResponse extends Response {
    resources: any[];
    resource: any;
  }
}

export class Api {

  private jwt: string;

  constructor(protected platform: TestPlatform, protected user: User) {
  }

  private async getJwtToken() {
    if (!this.jwt) {
      this.jwt = await this.platform.auth.getJWTToken({ sub: this.user.id });
    }
    return this.jwt;
  }

  async request(
    method: "GET" | "POST",
    url: string,
    payload: InjectPayload,
    headers: any,
  ): Promise<Response> {

    let totalHeaders = { authorization: `Bearer ${await this.getJwtToken()}` };

    if (headers) {
      totalHeaders = { ...totalHeaders, ...headers };
    }

    return this.platform.app
        .inject({
          method,
          url,
          headers: totalHeaders,
          payload,
        })
        .then(a => {
          if (a.statusCode !== 204) {
            log.debug(a.json(), `${method} ${url}`);
          }
          return a;
        });
  }

  public async get(url: string, headers?: any): Promise<Response> {
    return this.request("GET", url, undefined, headers);
  }

  public async post(
    url: string,
    payload: InjectPayload,
    headers?: any,
  ): Promise<Response> {
    return this.request("POST", url, payload, headers);
  }
}
