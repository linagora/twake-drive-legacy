import JwksClient from "jwks-rsa";
import nJwt from "njwt";
import { logger } from "../../../core/platform/framework/logger";

function verifyAudience(expected: string, aud: string | Array<string>) {
  if (!expected) {
    throw new Error("expected audience is required");
  }

  if (Array.isArray(aud) && !aud.includes(expected)) {
    throw new Error(
      `audience claim ${expected} does not match one of the expected audiences: ${aud.join(", ")}`,
    );
  }

  if (!Array.isArray(aud) && aud !== expected) {
    throw new Error(`audience claim ${aud} does not match expected audience: ${expected}`);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function verifyIssuer(expected: string, issuer: string) {
  if (issuer !== expected) {
    throw new Error(`issuer ${issuer} does not match expected issuer: ${expected}`);
  }
}

export class OidcJwtVerifier {
  public claimsToAssert: any;
  private issuer: string;
  private jwksUri: string;
  private jwksClient: any;
  private verifier: any;

  constructor(options: { [key: string]: any } = {}) {
    // https://github.com/auth0/node-jwks-rsa/blob/master/CHANGELOG.md#request-agent-options
    if (options.requestAgentOptions) {
      // jwks-rsa no longer accepts 'requestAgentOptions' and instead requires a http(s).Agent be passed directly
      const msg = `\`requestAgentOptions\` has been deprecated, use \`requestAgent\` instead. 
      For more info see https://github.com/auth0/node-jwks-rsa/blob/master/CHANGELOG.md#request-agent-options`;
      throw new Error(msg);
    }

    this.claimsToAssert = options.assertClaims || {};
    this.issuer = options.issuer;
    this.jwksUri = options.jwksUri;
    this.jwksClient = JwksClient({
      jwksUri: this.jwksUri,
      cache: true,
      cacheMaxAge: options.cacheMaxAge || 60 * 60 * 1000,
      cacheMaxEntries: 3,
      jwksRequestsPerMinute: options.jwksRequestsPerMinute || 10,
      rateLimit: true,
      requestAgent: options.requestAgent,
    });
    this.verifier = nJwt
      .createVerifier()
      .setSigningAlgorithm("RS256")
      .withKeyResolver((kid: string, cb: any) => {
        if (kid) {
          this.jwksClient.getSigningKey(kid, (err: any, key: any) => {
            cb(err, key && (key.publicKey || key.rsaPublicKey));
          });
        } else {
          cb("No KID specified", null);
        }
        return null;
      });
  }

  async verifyAsPromise(tokenString: string): Promise<any> {
    return new Promise((resolve, reject) => {
      // Convert to a promise
      this.verifier.verify(tokenString, (err: any, jwt: any) => {
        if (err) {
          return reject(err);
        }

        const jwtBodyProxy = new Proxy(jwt.body, {});
        Object.defineProperty(jwt, "claims", {
          enumerable: true,
          writable: false,
          value: jwtBodyProxy,
        });

        delete jwt.body;
        resolve(jwt);
      });
    });
  }

  async verifyIdToken(idTokenString: string, expectedClientId: string) {
    const jwt = await this.verifyAsPromise(idTokenString);
    verifyAudience(expectedClientId, jwt.claims.aud);
    logger.info(`issuer is ${this.issuer} -- ${jwt.claims.iss} -- ${JSON.stringify(jwt)}`);
    // verifyIssuer(this.issuer, jwt.claims.iss);

    return jwt;
  }

  async verifyLogoutToken(logoutTokenString: string) {
    const jwt = await this.verifyAsPromise(logoutTokenString);
    logger.info(`issuer is ${this.issuer} -- ${jwt.claims.iss} -- ${JSON.stringify(jwt)}`);
    return jwt;
  }
}
