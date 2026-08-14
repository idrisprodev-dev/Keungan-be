import { Controller, Get, Post, Delete, Param, Body, Req } from '@nestjs/common';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  async findAll(@Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.transactionsService.findAll(userId);
  }

  @Post()
  async create(@Body() body: any, @Req() req: any) {
    const userId = req.user?.userId || req.user?.sub || body.userId;
    if (!userId) throw new Error('Unauthorized');
    
    return this.transactionsService.create(userId, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.transactionsService.remove(userId, id);
  }
}