import Analytics, { IdentifyParams, TrackParams } from "@segment/analytics-node";
import { Analytics as AnalyticsAbtract } from "./types";
import axios, { AxiosInstance } from "axios";

export default class Segment implements AnalyticsAbtract {
  protected version = "5.0.0"; //Segment analytics lib version
  protected analytics: Analytics;

  protected axiosInstance: AxiosInstance;
  protected host: string;
  protected writeKey: string;
  protected timeout: string | number;

  constructor(key: string) {
    this.writeKey = key;
    this.host = "https://api.segment.io";
    this.timeout = 60000;
    this.axiosInstance = axios.create();
    this.analytics = new Analytics({
      host: this.host,
      writeKey: this.writeKey,
      httpRequestTimeout: this.timeout,
    });
  }

  public identify(
    message: (
      | { userId: string | number }
      | { userId?: string | number; anonymousId: string | number }
    ) & { traits?: any; timestamp?: Date; context?: any },
    callback?: (err: Error) => void,
  ): void {
    try {
      this.analytics.identify(message as IdentifyParams, callback);
    } catch (err) {
      console.error(err);
    }
  }

  public track(
    message: (
      | { userId: string | number }
      | { userId?: string | number; anonymousId: string | number }
    ) & { event: string; properties?: any; timestamp?: Date; context?: any },
    callback?: (err: Error) => void,
  ): void {
    try {
      this.analytics.track(message as TrackParams, callback);
    } catch (err) {
      console.error(err);
    }
  }

  public remove(message: { userId: string }, callback: (err: Error) => void) {
    (async () => {
      const headers: any = {};
      if (typeof window === "undefined") {
        headers["user-agent"] = `analytics-node/${this.version}`;
      }

      const req: any = {
        auth: {
          username: this.writeKey,
        },
        headers,
        timeout: 5000,
      };

      this.axiosInstance
        .post(
          `${this.host}/v1beta/workspaces/myworkspace/regulations`,
          {
            regulation_type: "Suppress_With_Delete",
            attributes: {
              name: "userId",
              values: [message.userId],
            },
          },
          req,
        )
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        .then(() => () => {})
        .catch(err => {
          if (err.response) {
            const error = new Error(err.response.statusText);
            return callback(error);
          }
          callback(err);
        });
    })();
  }
}
