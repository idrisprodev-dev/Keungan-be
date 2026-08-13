import { Controller, Get, Post, Body, Param, Patch, Delete, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GoalsService } from './goals.service';

@UseGuards(AuthGuard('jwt'))
@Controller('goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  // POST http://localhost:3001/goals
  @Post()
  createGoal(
    @Body() body: { name: string; targetAmount: number; deadline?: Date; userId: string }
  ) {
    return this.goalsService.createGoal(body);
  }

  // GET http://localhost:3001/goals?userId=[ID_USER]
  @Get()
  getGoals(@Query('userId') userId: string) {
    return this.goalsService.getGoalsByUser(userId);
  }

  // GET http://localhost:3001/goals/[ID_GOAL]
  @Get(':id')
  getGoalById(@Param('id') id: string) {
    return this.goalsService.getGoalById(id);
  }

  // PATCH http://localhost:3001/goals/[ID_GOAL]
  @Patch(':id')
  updateGoal(
    @Param('id') id: string,
    @Body() body: { name?: string; targetAmount?: number; currentAmount?: number; deadline?: Date }
  ) {
    return this.goalsService.updateGoal(id, body);
  }

  // DELETE http://localhost:3001/goals/[ID_GOAL]
  @Delete(':id')
  deleteGoal(@Param('id') id: string) {
    return this.goalsService.deleteGoal(id);
  }
}