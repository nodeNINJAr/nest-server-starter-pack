import { Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import Handlebars from 'handlebars';

@Injectable()
export class MailService implements OnModuleDestroy {
  private transporter?: nodemailer.Transporter;
  private readonly templates = new Map<string, Handlebars.TemplateDelegate>();
  constructor(private readonly config: ConfigService) {}

  private getTransporter() {
    if (this.transporter) return this.transporter;
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) throw new ServiceUnavailableException('Email delivery is not configured');
    const port = Number(this.config.get('SMTP_PORT') || 465);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      ...(user && pass ? { auth: { user, pass } } : {}),
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 30000,
    });
    return this.transporter;
  }

  async sendTemplateMail(
    templateName: string,
    to: string,
    subject: string,
    data: Record<string, unknown>,
  ) {
    if (!/^[a-z0-9-]+$/.test(templateName)) throw new Error('Invalid template name');
    let template = this.templates.get(templateName);
    if (!template) {
      template = Handlebars.compile(
        await readFile(join(__dirname, 'templates', `${templateName}.hbs`), 'utf8'),
      );
      this.templates.set(templateName, template);
    }
    await this.getTransporter().sendMail({
      from: this.config.get<string>('SMTP_FROM') || this.config.get<string>('SMTP_USER'),
      to,
      subject,
      html: template(data),
    });
  }
  onModuleDestroy() {
    this.transporter?.close();
  }
}
