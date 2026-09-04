import { SetMetadata } from '@nestjs/common';

export const SKIP_PLAN_STATUS_KEY = 'skipPlanStatus';
export const SkipPlanStatus = () => SetMetadata(SKIP_PLAN_STATUS_KEY, true);
