import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { config } from './index';

export const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null;

export const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: false,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
  connectionTimeout: 15000,
  socketTimeout: 15000,
  greetingTimeout: 15000,
});
