import { useEffect } from 'react';
import { useRecoilCallback, useRecoilValue } from 'recoil';

import { OnlineUserStateFamily, OnlineUserType } from '../state/atoms/online-users';
//TODO refactor it in the notification feature

// import { OnlineUserRealtimeAPI } from '../api/online-user-realtime-api-client';
// import WebSocketFactory from '../../global/services/websocket-factory-service';

export const useOnlineUser = (id: string): OnlineUserType => {

  // const OnlineAPI = OnlineUserRealtimeAPI(WebSocketFactory.get());

  // const updateUser = useRecoilCallback(
  //   ({ set, snapshot }) =>
  //     (status: { id: string; connected: boolean }) => {
  //       const current = snapshot.getLoadable(OnlineUserStateFamily(status.id)).contents;
  //       set(OnlineUserStateFamily(status.id), {
  //         ...status,
  //         lastSeen: status.connected ? Date.now() : current.lastSeen,
  //         initialized: true,
  //       });
  //     },
  //   [],
  // );

  const state = useRecoilValue(OnlineUserStateFamily(id));

  useEffect(() => {
    if (state && !state.initialized) {
      // OnlineAPI.getUserStatus(id).then(status => {
      //   updateUser({ id: status[0], connected: status[1] });
      // });
    }
  }, [state, id]);

  return state;
};
