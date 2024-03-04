import { getLogger, TdriveLogger, TdriveService } from "../../framework";
import EmailPusherAPI from "./provider";
import {
  EmailBuilderDataPayload,
  EmailBuilderRenderedResult,
  EmailBuilderTemplateName,
  EmailPusherEmailType,
  EmailPusherPayload,
  EmailPusherResponseType,
  SMTPClientConfigType,
} from "./types";
import nodemailer from "nodemailer";
import * as Eta from "eta";
import { convert } from "html-to-text";
import path from "path";
import { existsSync } from "fs";
import axios from "axios";
import short, { Translator } from "short-uuid";

export default class EmailPusherClass
  extends TdriveService<EmailPusherAPI>
  implements EmailPusherAPI
{
  readonly name = "email-pusher";
  readonly version: "1.0.0";
  logger: TdriveLogger = getLogger("email-pusher-service");
  interface: string;
  apiKey: string;
  apiUrl: string;
  sender: string;
  transporter: any;
  debug: boolean;
  platformUrl: string;

  api(): EmailPusherAPI {
    return this;
  }

  async doInit(): Promise<this> {
    Eta.configure({
      views: path.join(__dirname, "templates"),
    });
    this.interface = this.configuration.get<string>("email_interface", "");
    this.platformUrl = this.configuration.get<string>("platform_url", "");
    if (this.interface === "smtp") {
      const useTLS = this.configuration.get<string>("smtp_tls", "false") == "true";
      const smtpConfig: SMTPClientConfigType = {
        host: this.configuration.get<string>("smtp_host", ""),
        port: this.configuration.get<number>("smtp_port", 25),
        secure: false,
        ignoreTLS: !useTLS,
        requireTLS: useTLS,
      };
      this.logger.info(`Start SMTP client with configuration: ${JSON.stringify(smtpConfig)}`);
      this.transporter = nodemailer.createTransport(smtpConfig);
      this.sender = this.configuration.get<string>("sender", "");
    } else {
      this.transporter = null;
      this.apiUrl = this.configuration.get<string>("endpoint", "");
      this.apiKey = this.configuration.get<string>("api_key", "");
      this.sender = this.configuration.get<string>("sender", "");
      this.debug = this.configuration.get<boolean>("debug", false);
    }

    return this;
  }

  /**
   * Generate a rendered HTML and text email
   *
   * @param {EmailBuilderTemplateName} template - the Eta template name
   * @param {String} language - the template language
   * @param {EmailBuilderDataPayload} data - the data
   * @returns {EmailBuilderRenderedResult} - the rendered html and text version
   */
  async build(
    template: EmailBuilderTemplateName,
    language: string,
    data: EmailBuilderDataPayload,
  ): Promise<EmailBuilderRenderedResult> {
    try {
      language = ["en", "fr"].find(l => language.toLocaleLowerCase().includes(l)) || "en";
      const translator: Translator = short();
      const templatePath = path.join(__dirname, "templates", language, `${template}.eta`);
      const subjectPath = path.join(__dirname, "templates", language, `${template}.subject.eta`);
      const encodedCompanyId = translator.fromUUID(data.notifications[0].item.company_id);
      const encodedFileId = translator.fromUUID(data.notifications[0].item.id);
      const encodedUrl = `${this.platformUrl}/client/${encodedCompanyId}/v/shared_with_me/preview/${encodedFileId}`;

      if (!existsSync(templatePath)) {
        throw Error(`template not found: ${templatePath}`);
      }

      if (!existsSync(subjectPath)) {
        throw Error(`subject template not found: ${subjectPath}`);
      }
      console.log("🚀 FILE LINK: ", encodedUrl);
      const html = await Eta.renderFile(templatePath, {
        ...data,
        encodedUrl,
      });

      if (!html || !html.length) {
        throw Error("Failed to render template");
      }

      const text = convert(html);

      const subject = convert((await Eta.renderFile(subjectPath, data)) as string);

      return { html, text, subject };
    } catch (error) {
      this.logger.error(`Failure when building email template: ${error}`);
    }
  }

  /**
   * Send email
   *
   * @param {string} to - the recipient
   * @param {EmailPusherPayload} email - the email object
   * @returns {Promise<void>}
   */
  async send(
    to: string,
    { subject, html: html_body, text: text_body }: EmailPusherPayload,
  ): Promise<void> {
    try {
      this.logger.info("sending email");
      if (!html_body || !text_body || !subject || !to) {
        this.logger.error("invalid email");
        throw Error("invalid email");
      }

      const emailObject = {
        api_key: this.apiKey,
        to: [to],
        subject,
        text_body,
        html_body,
        sender: this.sender,
      };

      if (this.debug) {
        this.logger.info("EMAIL::SENT ", { emailObject });
      } else {
        if (this.interface === "smtp") {
          try {
            this.logger.info("sending email via smtp interface.");
            const info = await this.transporter.sendMail({
              from: `"Twake Drive" <${this.sender}>`,
              to: to,
              subject: subject,
              text: text_body,
              html: html_body,
            });

            this.logger.info("Message sent: %s", info.response);
          } catch (err) {
            this.logger.error(
              {
                error: `${err}`,
                smtpConfig: {
                  host: this.configuration.get<string>("smtp_host", ""),
                  port: this.configuration.get<number>("smtp_port", 25),
                  secure: false,
                },
              },
              "Failed to send email",
            );
          }
        } else {
          this.logger.info("sending email via api interface.");
          const { data } = await axios.post<EmailPusherEmailType, EmailPusherResponseType>(
            `${this.apiUrl}`,
            emailObject,
          );
          if (data.error && data.error.length) {
            throw Error(data.error);
          }

          if (data.failed === 1 && data.failures.length) {
            throw Error(data.failures.join(""));
          }

          if (data.succeeded) {
            this.logger.info("email sent");
          }
        }
      }
    } catch (error) {
      this.logger.error({ error: `${error}` }, "Failed to send email");
    }
  }
}
