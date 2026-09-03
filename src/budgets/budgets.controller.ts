import { Controller, Get, Post, Delete, Body, Req, UseGuards, Query, Param, UnauthorizedException, Put } from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlanStatusGuard } from '../auth/guards/plan-status.guard';
import { UpdateBudgetDto } from './dto/create-budget.dto';

// JwtAuthGuard: pastikan login. PlanStatusGuard: blokir mutasi (POST/PUT/DELETE)
// saat user FREE (trial habis = read-only). GET tetap diizinkan.
@UseGuards(JwtAuthGuard, PlanStatusGuard)
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  // Fungsi pembantu untuk mengambil ID user dari berbagai kemungkinan format token JWT
  private extractUserId(req: any): string {
    const userId = req.user?.id || req.user?.sub || req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Token user tidak valid atau ID tidak ditemukan.');
    }
    return userId;
  }

  @Get()
  findAll(@Req() req, @Query('month') month?: string, @Query('year') year?: string) {
    const userId = this.extractUserId(req);
    const currentMonth = month ? parseInt(month, 10) : new Date().getMonth() + 1;
    const currentYear = year ? parseInt(year, 10) : new Date().getFullYear();
    
    return this.budgetsService.findAll(userId, currentMonth, currentYear);
  }

  @Post()
  upsert(@Req() req, @Body() body) {
    const userId = this.extractUserId(req);
    return this.budgetsService.upsert(userId, body);
  }

@Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateBudgetDto) {
    const userId = this.extractUserId(req);
    return this.budgetsService.update(id, userId, dto);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    const userId = this.extractUserId(req);
    return this.budgetsService.remove(userId, id);
  }
}