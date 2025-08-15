import { config } from '@infrastructure/config/env';

export interface PhaseStatus {
  isRegistrationActive: boolean;
  daysUntilStart: number;
  endDate: Date;
  startDate: Date;
  durationMonths: number;
}

export function calculatePhaseStatus(): PhaseStatus {
  const startDate = config.solana.phase.startDate;
  const durationMonths = Number.parseInt(config.solana.phase.monthDuration);

  const now = new Date();
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + durationMonths);

  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);
  const nowObj = new Date(now);

  const isRegistrationActive = nowObj < startDateObj;
  const timeUntilStart = startDateObj.getTime() - nowObj.getTime();
  const daysUntilStart = Math.ceil(timeUntilStart / (1000 * 60 * 60 * 24));

  return {
    isRegistrationActive,
    daysUntilStart: Math.max(0, daysUntilStart),
    endDate: endDateObj,
    startDate: startDateObj,
    durationMonths
  };
}
