import { Controller, Get, Post, Delete, Param, Body, Req } from '@nestjs/common';
import { SmartRulesService } from './smart-rules.service';

@Controller('smart-rules')
export class SmartRulesController {
  constructor(private readonly smartRulesService: SmartRulesService) {}

  @Get()
  async findAll(@Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.smartRulesService.findAll(userId);
  }

  @Post()
  async create(@Body() body: { keyword: string; categoryId: string; targetSheetId?: string }, @Req() req: any) {
    const userId = req.user?.userId || req.user?.sub || body['userId']; 
    if (!userId) throw new Error('Unauthorized');
    
    return this.smartRulesService.create(userId, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.smartRulesService.remove(userId, id);
  }
}