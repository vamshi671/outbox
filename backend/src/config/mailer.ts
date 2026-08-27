import nodemailer from 'nodemailer';
import { config } from './index';

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
