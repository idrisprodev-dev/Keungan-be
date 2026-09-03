import { Controller, Get, Post, Put, Delete, Param, Body, Req, UseGuards } from '@nestjs/common';
import { SmartRulesService } from './smart-rules.service';
import { RequirePlan } from '../auth/decorators/require-plan.decorator';
import { PlanGuard } from '../auth/guards/plan.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// Fitur lanjutan: SELURUH akses (termasuk GET) ke Smart Rules
// hanya boleh untuk user PRO/PLATINUM. Guard ini akan menolak akses
// (403 Forbidden) bagi user FREE / trial yang sudah habis.
@Controller('smart-rules')
@UseGuards(JwtAuthGuard, PlanGuard)
@RequirePlan('PRO')
export class SmartRulesController {
  constructor(private readonly smartRulesService: SmartRulesService) {}



    @Post()
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