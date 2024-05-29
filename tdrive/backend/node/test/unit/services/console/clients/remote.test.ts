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
    "sid": "Ev81/QODom0HXu9MGjCwnn1tDTpji+j0jopjRAE0ypo",
    "aud": [
      "twakedrive"
    ],
    "sub": "shepilov3@stg.lin-saas.com",
    "iat": 1716986356,
    "jti": "F9R6DYPE",
    "events": {
      "http://schemas.openid.net/event/backchannel-logout": {}
    },
    "iss": "https://sign-up.stg.lin-saas.com/"
  };

  const mockTokenWithoutProperty = (prop: string) => {
    const token = _.cloneDeep(validToken);
    token[prop] = null
    verifyTokenMock.mockImplementation(() => {
      return Promise.resolve(token); // Return the predefined payload
    });
  }

  it("backChannelLogout should throw error if 'iss' claim is missing", () => {
    //given
    mockTokenWithoutProperty("iss")
    //when
    let logout = subj.backChannelLogout('');
    //then
    expect(logout).rejects.toThrow("Missing required 'iss' claim");

  });

  it("backChannelLogout should throw error if 'aud' claim is missing", () => {
    //given
    mockTokenWithoutProperty("aud")
    //when
    let logout = subj.backChannelLogout('');
    //then
    expect(logout).rejects.toThrow("Missing required 'aud' claim");
  });

  it("backChannelLogout should throw error if 'jti' claim is missing", () => {
    //given
    mockTokenWithoutProperty("jti")
    //when
    let logout = subj.backChannelLogout('');
    //then
    expect(logout).rejects.toThrow("Missing required 'jti' claim");
  });

  it("backChannelLogout should throw error if 'iat' claim is missing", () => {
    //given
    mockTokenWithoutProperty("iat")
    //when
    let logout = subj.backChannelLogout('');
    //then
    expect(logout).rejects.toThrow("Missing required 'iat' claim");
  });

  it("backChannelLogout should throw error if 'events' claim is missing", () => {
    //given
    mockTokenWithoutProperty("events")
    //when
    let logout = subj.backChannelLogout('');
    //then
    expect(logout).rejects.toThrowError("Missing required 'events' claim");
  });

  it("backChannelLogout should throw error if 'sub' claim is missing", () => {
    //given
    mockTokenWithoutProperty("sub")
    //when
    let logout = subj.backChannelLogout('');
    //then
    expect(logout).rejects.toThrowError("Missing 'sub' claim");
  });

  it("backChannelLogout should throw error if 'sid' claim is missing", () => {
    //given
    mockTokenWithoutProperty("sid")
    //when
    let logout = subj.backChannelLogout('');
    //then
    expect(logout).rejects.toThrowError("Missing 'sid' claim");
  });
})