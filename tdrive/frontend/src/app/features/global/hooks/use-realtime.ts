/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from 'react';
import useWebSocket from '@features/global/hooks/use-websocket';
import Logger from '@features/global/framework/logger-service';
import {
  RealtimeBaseAction,
  RealtimeBaseEvent,
  RealtimeResourceEvent,
} from '../types/realtime-types';
import { WebsocketRoom } from '@features/global/types/websocket-types';

const logger = Logger.getLogger('useRealtimeRoom');

export type RealtimeRoomService<T> = {
  lastEvent: T;
  send: (data: T) => void;
  emit: (event: string, data: T) => void;
};

/**
 * Subscribe to a room using websocket channel.
 *
 * Note: It will subscribe only once, even if the component using it re renders. If you need to unsubscribe and subscribe again, call unsubscribe on the returned object.
 *
 * @param roomConf
 * @param tagName
 * @param onEvent
 * @returns
 */
const useRealtimeRoom = <T>(
  roomConf: WebsocketRoom,
  tagName: string,
  onEvent: (action: RealtimeBaseAction, event: T) => void,
) => {
  const { websocket } = useWebSocket();
  const [lastEvent, setLastEvent] = useState<{ action: RealtimeBaseAction; payload: T }>();
  const [room, setRoom] = useState(roomConf);
  const [tag] = useState(tagName);
  // subscribe once
  const subscribed = useRef(false);

  const newEvent = useCallback(
    (event: { action: RealtimeBaseAction; payload: T }) => {
      if (event) {
        setLastEvent(event);
        onEvent(event.action, event.payload);
      }
    },
    [onEvent],
  );

  useEffect(() => {
    if (room !== roomConf) {
      setRoom({ ...roomConf });
      if (room && subscribed.current && websocket) {
        websocket.leave(room.room, tag);
        subscribed.current = false;
      }
    }
  }, [roomConf?.room, roomConf?.token, tagName]);

  useEffect(() => {
    if (room && room.room && websocket && !subscribed.current) {
      websocket.join(room.room, room.token, tag, (type: string, event: RealtimeBaseEvent) => {
        logger.debug('Received WebSocket event', type, event);
        if (type === 'realtime:resource') {
          newEvent({
            action: (event as RealtimeResourceEvent<T>).action,
            payload: {
              ...(event as RealtimeResourceEvent<T>).resource,
              _type: (event as RealtimeResourceEvent<T>).type,
            },
          });
        } else if (type === 'realtime:event') {
          newEvent({ action: 'event', payload: event.data });
        } else if (type === 'realtime:join:success') {
          logger.debug(`Room ${room} has been joined`);
        } else {
          logger.debug('Event type is not supported', type);
        }
      });
      subscribed.current = true;
    }
  }, [websocket, tag, room, onEvent]);

  return {
    lastEvent,
    send: (data: any) => websocket?.send(room.room, room.token, data),
    unsubscribe: () => {
      subscribed.current = false;
      websocket?.leave(room.room, tagName);
    },
  };
};

export { useRealtimeRoom };
