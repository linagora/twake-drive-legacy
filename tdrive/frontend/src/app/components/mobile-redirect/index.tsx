import React, { ReactNode } from 'react';
import configuration from '../../environment/environment';
import { Smartphone, X } from 'react-feather';
import './style.scss';
import { Button } from 'antd';
import InitService from '../../features/global/services/init-service';
import LocalStorage from '@features/global/framework/local-storage-service';

const environment = configuration;

type SearchParamsType = {
  [k: string]: string;
};

export default function MobileRedirect(props: { children: ReactNode }) {
  const os = "other";
  const searchParams: SearchParamsType = Object.fromEntries(
    new URLSearchParams(window.location.search),
  );

  const parameters = InitService.server_infos?.configuration.mobile;

  const getapp = searchParams.getapp;
  let forceUseWeb: string | boolean = true;
  const originInUrl = searchParams.origin;

  delete searchParams.useweb;
  delete searchParams.getapp;
  delete searchParams.origin;

  if (forceUseWeb) {
    LocalStorage.setItem('useweb', new Date().getTime());
  } else {
    forceUseWeb =
      new Date().getTime() - parseInt(LocalStorage.getItem('useweb') || '0') <
      1000 * 60 * 60 * 24 * 3; //We re-ask to download app every 3 days
  }

  //If requested in url: redirect to stores
  if (getapp && parameters?.mobile_appstore && parameters?.mobile_googleplay) {
    // if (os === 'android') {
    //   document.location.replace(parameters?.mobile_googleplay);
    // } else if (os === 'ios') {
    //   document.location.replace(parameters?.mobile_appstore);
    // }
    return <></>;
  }

  //We must wait for server parameters at least
  if (!InitService.server_infos_loaded) {
    return <></>;
  }

  //For desktop we don't show the open on app popup
  if (
    forceUseWeb ||
    os === 'other' ||
    !parameters?.mobile_redirect ||
    (!environment?.front_root_url && !originInUrl) ||
    typeof window === 'undefined'
  ) {
    if (os !== 'other')
      console.log('Keep on browser because:', {
        forceUseWeb,
        os,
        mobile_redirect: parameters?.mobile_redirect,
        front_root_url: environment?.front_root_url,
        originInUrl,
        windowUndefined: typeof window === 'undefined',
      });

    return <>{props.children}</>;
  }

  const origin = (originInUrl || environment?.front_root_url || '')
    .replace(/https?:\/\//g, '')
    .split('/')[0];
  const redirectOrigin = parameters?.mobile_redirect.replace(/https?:\/\//g, '').replace(/\//g, '');

  //For mobile first we ensure to be on the m.domain.com url
  if (window.location.origin.replace(/https?:\/\//g, '').replace(/\//g, '') !== redirectOrigin) {
    window.location.replace(
      //The redirection to the app MUST be from ANOTHER domain to work in devices webviews (like in facebook messenger)
      `${window.location.protocol}//${redirectOrigin}${
        window.location.pathname
      }?${new URLSearchParams(
        Object.assign(searchParams, { origin: window.location.origin }),
      ).toString()}`,
    );
    return <div></div>;
  }

  //Here we are on m.domain.com/some-path and we are on a mobile device
  const backToWebUrl = (getApp = true) =>
    `${window.location.protocol}//${origin}${window.location.pathname}?${new URLSearchParams(
      Object.assign({}, searchParams, getApp ? { getapp: 1 } : { useweb: 1 }),
    ).toString()}`;

  return (
    <>
      <div className="mobile_redirect_container">
        <div className="open_on_mobile">
          <span className="open_on_mobile_title">Open Tdrive in...</span>
          <a className="open_on_mobile_actions" href={backToWebUrl()}>
            <Smartphone /> <span>Tdrive App</span>
            <span style={{ flex: 1 }}></span>
            <Button className="action_button" type="primary">
              Open
            </Button>
          </a>
          <span
            className="open_on_mobile_actions"
            onClick={() => document.location.replace(backToWebUrl(false))}
          >
            <X /> <span>Continue on web</span>
            <span style={{ flex: 1 }}></span>
            <Button className="action_button" type="ghost">
              Continue
            </Button>
          </span>
        </div>
      </div>
    </>
  );
}
