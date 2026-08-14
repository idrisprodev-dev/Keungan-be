import { Controller, Get, Post, Put, Delete, Param, Body, Req } from '@nestjs/common';
import { GoalsService } from './goals.service';

@Controller('goals')
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