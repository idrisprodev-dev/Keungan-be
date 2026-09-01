import { Controller, Get, Post, Put, Delete, Param, Body, Req, UseGuards } from '@nestjs/common';
import { SmartRulesService } from './smart-rules.service';
import { RequirePlan } from '../auth/decorators/require-plan.decorator';
import { PlanGuard } from '../auth/guards/plan.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('smart-rules')
export class SmartRulesController {
  constructor(private readonly smartRulesService: SmartRulesService) {}



    @Post()
    @UseGuards(JwtAuthGuard, PlanGuard) // 1. Pasang Guard
   @RequirePlan('PRO')// 2. Tentukan minimal level PLAN
  async create(@Body() body: { keyword: string; categoryId: string; targetSheetId?: string }, @Req() req: any) {
    const userId = req.user?.userId || req.user?.sub || body['userId']; 
    if (!userId) throw new Error('Unauthorized');
    
    return this.smartRulesService.create(userId, body);
  }
  
  @Get()
  async findAll(@Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.smartRulesService.findAll(userId);
  }



  @Put(':id')
  async update(@Param('id') id: string, @Body() body: { keyword?: string; categoryId?: string }, @Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.smartRulesService.update(userId, id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.smartRulesService.remove(userId, id);
  }


  
}