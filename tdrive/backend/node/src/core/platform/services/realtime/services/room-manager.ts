import { logger } from "../../../framework/logger";
import {
  JoinLeaveRoomError,
  JoinLeaveRoomSuccess,
  JoinRoomEvent,
  LeaveRoomEvent,
  ClientEvent,
  WebsocketRoomSignature,
} from "../types";
import { RealtimeRoomManager } from "../api";
import WebSocketAPI from "../../../services/websocket/provider";
import { WebSocketUser, WebSocket } from "../../../services/websocket/types";
import AuthService from "../../auth/provider";

export default class RoomManager implements RealtimeRoomManager {
  constructor(private ws: WebSocketAPI, private auth: AuthService) {}

  init(): void {
    this.ws.onUserConnected(event => {
      logger.info(`User ${event.user.id} is connected`);

      event.socket.on("realtime:join", async (joinEvent: JoinRoomEvent) => {
        const canJoin =
          joinEvent.name.indexOf("previous::") === 0 || //Compatibility with old collections
          (await this.userCanJoinRoom(event.user, joinEvent));

        if (canJoin) {
          this.join(event.socket, joinEvent.name, event.user);
        } else {
          this.sendError("join", event.socket, {
            name: joinEvent.name,
            message: "User is not authorized to join room",
          });
        }
      });

      event.socket.on("realtime:leave", (leaveEvent: LeaveRoomEvent) => {
        this.leave(event.socket, leaveEvent.name, event.user);
      });

      event.socket.on("realtime:event", async (clientEvent: ClientEvent) => {
        const canEmit =
          clientEvent.name.indexOf("previous::") === 0 || //Compatibility with old collections
          (await this.userCanEmitInRoom(event.user, clientEvent));
        if (canEmit) {
          this.sendEvent(clientEvent.name, clientEvent.data);
        } else {
          this.sendError("event", event.socket, {
            name: clientEvent.name,
            message: "User is not authorized to emit in this room",
          });
        }
      });
    });

    this.ws.onUserDisconnected(event => {
      logger.info(`User ${event.user.id} is disconnected`);
      this.leaveAll(event.socket, event.user);
    });
  }

  getConnectedUsers(room: string): number {
    if (this.ws.getIo().sockets.adapter.rooms.has(room)) {
      return this.ws.getIo().sockets.adapter.rooms.get(room).entries.length;
    }

    return 0;
  }

  /**
   * Check of the user can join room
   *
   * @param user
   * @param joinEvent
   * @return Promise<boolean> true if can join, false otherwise. Never rejects.
   */
  async userCanJoinRoom(user: WebSocketUser, joinEvent: JoinRoomEvent): Promise<boolean> {
    logger.info(`Checking if user ${user.id} can join room ${joinEvent.name} with token`);

    try {
      //Public rooms we just check the user is logged in
      if (
        joinEvent.name.startsWith("/users/") || //User update room
        joinEvent.name === "/ping"
      ) {
        return !!this.auth.verifyToken(joinEvent.token)?.sub;
      }

      //Retro-compatibility for mobile up to february 2021 (to remove after this date)
      if (joinEvent.token === "tdrive") return true;

      const signature = this.auth.verifyTokenObject<WebsocketRoomSignature>(joinEvent.token);

      return (
        signature &&
        signature.name === joinEvent.name &&
        signature.sub === user.id &&
        signature.iat > Math.round(new Date().getTime() / 1000)
      );
    } catch (err) {
      console.log(err);
      return false;
    }
  }

  userCanEmitInRoom = this.userCanJoinRoom;

  async join(websocket: WebSocket, room: string, user: WebSocketUser): Promise<void> {
    logger.info(`User ${user.id} is joining room ${room}`);

    try {
      await websocket.join(room);
    } catch (err) {
      if (err) {
        logger.error(`Error while joining room ${room}`, err);
        this.sendError("join", websocket, {
          name: room,
          message: "Error while joining room",
        });
        return;
      }
    }

    this.sendSuccess("join", websocket, { name: room });
    logger.info(`User ${user.id} joined room ${room}`);
  }

  async leave(websocket: WebSocket, room: string, user: WebSocketUser): Promise<void> {
    logger.info(`User ${user.id} is leaving room ${room}`);

    try {
      await websocket.leave(room);
    } catch (err) {
      if (err) {
        logger.error(`Error while leaving room ${room}`, err);
        this.sendError("leave", websocket, {
          name: room,
          message: "Error while leaving room",
        });
        return;
      }
    }

    this.sendSuccess("leave", websocket, { name: room });
    logger.info(`User ${user.id} left room ${room}`);
  }

  leaveAll(websocket: WebSocket, user: WebSocketUser): void {
    logger.info(`Leaving rooms for user ${user.id}`);
    websocket.rooms.forEach(room => websocket.leave(room));
  }

  sendError(event: string, websocket: WebSocket, error: JoinLeaveRoomError): void {
    websocket.emit(`realtime:${event}:error`, error);
  }

  sendSuccess(event: string, websocket: WebSocket, success: JoinLeaveRoomSuccess): void {
    websocket.emit(`realtime:${event}:success`, success);
  }

  sendEvent(path: string, data: any): void {
    this.ws.getIo().to(path).emit("realtime:event", { name: path, data: data });
  }
}
