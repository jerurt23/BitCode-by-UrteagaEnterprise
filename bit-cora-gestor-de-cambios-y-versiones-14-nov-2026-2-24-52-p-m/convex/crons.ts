import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// Todos los días a las 13:00 UTC (8:00 a.m. en hora del Este).
crons.daily(
  'recordatorios-fecha-limite',
  { hourUTC: 13, minuteUTC: 0 },
  internal.push.sendDeadlineReminders,
);

export default crons;
