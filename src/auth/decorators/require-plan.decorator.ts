// (Buat file baru jika belum ada)
// 💡 Buat apa? Decorator ini berfungsi sebagai "label" atau "tag" yang bisa Anda tempelkan di atas endpoint (route). Tujuannya untuk memberi tahu NestJS: "Hei, endpoint ini hanya boleh diakses minimal oleh user berstatus PRO".

// TypeScript

import { SetMetadata } from '@nestjs/common';

// Anda bisa menyesuaikan urutan hierarki plan
export type PlanLevel = 'FREE' | 'PRO' | 'PLATINUM';

export const REQUIRE_PLAN_KEY = 'requirePlan';
export const RequirePlan = (plan: PlanLevel) => SetMetadata(REQUIRE_PLAN_KEY, plan);