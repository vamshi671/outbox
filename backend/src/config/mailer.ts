import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { config } from './index';

export const resend = new Resend(config.resendApiKey);

export const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: false,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
  connectionTimeout: 10000,
  socketTimeout: 10000,
  greetingTimeout: 10000,
});
