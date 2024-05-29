import { describe, expect, it } from "@jest/globals";
// @ts-ignore
import _ from "lodash";
import { ConsoleRemoteClient } from "../../../../../src/services/console/clients/remote";
import { OidcJwtVerifier } from "../../../../../src/services/console/clients/remote-jwks-verifier";
import { ConsoleServiceImpl } from "../../../../../src/services/console/service";

describe("Test back-channel logout", () => {

  const subj = new ConsoleRemoteClient(new ConsoleServiceImpl({
    audience: "",
    authority: "",
    client_id: "",
    client_secret: "",
    disable_account_creation: false,
    jwks_uri: "",
    redirect_uris: [],
    type: undefined,
    issuer: "" }));
  const verifyTokenMock = jest.spyOn(OidcJwtVerifier.prototype, "verifyLogoutToken");

  const validToken = {
    "header": {
      "typ": "JWT",
      "alg": "RS256",
      "kid": "UrLwYyzqASOKT5wUedHERA"
    },
    "claims": {
      "iat": 1716995003,
      "sub": "shepilov3@stg.lin-saas.com",
      "sid": "WSqrLJG8wNLECdxKIBrR9mdu3PmLFDUd4zHZ+1RLOYI",
      "events": {
        "http://schemas.openid.net/event/backchannel-logout": {}
      },
      "jti": "K9B59EPB",
      "aud": [
        "twakedrive"
      ],
      "iss": "https://sign-up.stg.lin-saas.com/"
    }
  };

  const mockTokenWithoutClaim = (claim: string) => {
    const token = _.cloneDeep(validToken);
    token.claims[claim] = null
    verifyTokenMock.mockImplementation(() => {
      return Promise.resolve(token); // Return the predefined payload
    });
  }

  it("backChannelLogout should throw error if 'iss' claim is missing", () => {
    //given
    mockTokenWithoutClaim("iss")
    //when
    let logout = subj.backChannelLogout('');
    //then
    expect(logout).rejects.toThrow("Missing required 'iss' claim");

  });

  it("backChannelLogout should throw error if 'aud' claim is missing", () => {
    //given
    mockTokenWithoutClaim("aud")
    //when
    let logout = subj.backChannelLogout('');
    //then
    expect(logout).rejects.toThrow("Missing required 'aud' claim");
  });

  it("backChannelLogout should throw error if 'jti' claim is missing", () => {
    //given
    mockTokenWithoutClaim("jti")
    //when
    let logout = subj.backChannelLogout('');
    //then
    expect(logout).rejects.toThrow("Missing required 'jti' claim");
  });

  it("backChannelLogout should throw error if 'iat' claim is missing", () => {
    //given
    mockTokenWithoutClaim("iat")
    //when
    let logout = subj.backChannelLogout('');
    //then
    expect(logout).rejects.toThrow("Missing required 'iat' claim");
  });

  it("backChannelLogout should throw error if 'events' claim is missing", () => {
    //given
    mockTokenWithoutClaim("events")
    //when
    let logout = subj.backChannelLogout('');
    //then
    expect(logout).rejects.toThrowError("Missing required 'events' claim");
  });

  it("backChannelLogout should throw error if 'sub' claim is missing", () => {
    //given
    mockTokenWithoutClaim("sub")
    //when
    let logout = subj.backChannelLogout('');
    //then
    expect(logout).rejects.toThrowError("Missing 'sub' claim");
  });

  it("backChannelLogout should throw error if 'sid' claim is missing", () => {
    //given
    mockTokenWithoutClaim("sid")
    //when
    let logout = subj.backChannelLogout('');
    //then
    expect(logout).rejects.toThrowError("Missing 'sid' claim");
  });
})