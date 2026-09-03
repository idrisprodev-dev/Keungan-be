import { Controller, Get, Post, Put, Delete, Param, Body, Req, UseGuards } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlanStatusGuard } from '../auth/guards/plan-status.guard';

// JwtAuthGuard: pastikan login. PlanStatusGuard: blokir mutasi (POST/PUT/DELETE)
// saat user FREE (trial habis). GET tetap boleh (lihat riwayat).
@Controller('goals')
@UseGuards(JwtAuthGuard, PlanStatusGuard)
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Get()
  async findAll(@Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.goalsService.getGoalsByUser(userId);
  }

  @Post()
  async create(@Body() body: any, @Req() req: any) {
    const userId = req.user?.userId || req.user?.sub || body.userId;
    if (!userId) throw new Error('Unauthorized');
    return this.goalsService.createGoal(userId, body);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.goalsService.updateGoal(id, userId, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.goalsService.deleteGoal(id, userId);
  }
}