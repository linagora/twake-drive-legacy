import { JwtConfiguration } from "./provider";
import jwt from "jsonwebtoken";
import { AccessToken, JWTObject, uuid } from "../../../../utils/types";
import assert from "assert";
import { JwtType } from "../types";
import AuthServiceAPI from "./provider";

export class AuthService implements AuthServiceAPI {
  version: "1";

  constructor(private configuration: JwtConfiguration) {}

  getTypes(): string[] {
    throw new Error("Method not implemented.");
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  sign(payload: string | object | Buffer): string {
    return jwt.sign(payload, this.configuration.secret);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  verifyToken(token: string): JWTObject {
    return jwt.verify(token, this.configuration.secret) as JWTObject;
  }

  verifyTokenObject<T>(token: string): T {
    return jwt.verify(token, this.configuration.secret) as T;
  }

  generateJWT(
    userId: uuid,
    email: string,
    session: string,
    options: {
      track: boolean;
      provider_id: string;
      application_id?: string;
      public_token_document_id?: string;
    },
  ): AccessToken {
    const now = Math.round(new Date().getTime() / 1000); // Current time in UTC
    assert(this.configuration.expiration, "jwt.expiration is missing");
    assert(this.configuration.refresh_expiration, "jwt.refresh_expiration is missing");

    const jwtExpiration = now + this.configuration.expiration;
    const jwtRefreshExpiration = now + this.configuration.refresh_expiration;
    return {
      time: now,
      expiration: jwtExpiration,
      refresh_expiration: jwtRefreshExpiration,
      value: this.sign({
        exp: jwtExpiration,
        type: "access",
        iat: now - 60 * 10,
        nbf: now - 60 * 10,
        sub: userId,
        sid: session,
        email: email,
        track: !!options.track,
        provider_id: options.provider_id || "",
        application_id: options.application_id,
        public_token_document_id: options.public_token_document_id,
      } as JwtType),
      refresh: this.sign({
        exp: jwtRefreshExpiration,
        type: "refresh",
        iat: now - 60 * 10,
        nbf: now - 60 * 10,
        sub: userId,
        sid: session,
        email: email,
        track: !!options.track,
        provider_id: options.provider_id || "",
        application_id: options.application_id,
        public_token_document_id: options.public_token_document_id,
      } as JwtType),
      type: "Bearer",
    };
  }
}
