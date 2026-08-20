import { Controller, Get, Post, Delete, Param, Body, Req, UseInterceptors, UseGuards } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  async findAll(@Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.transactionsService.findAll(userId);
  }

  // @UseInterceptors memastikan bahwa sebelum fungsi create() dieksekusi,
  // request harus lolos dari pemeriksaan IdempotencyInterceptor terlebih dahulu.
  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Body() createTransactionDto: CreateTransactionDto, @Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.transactionsService.create(userId, createTransactionDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.transactionsService.remove(userId, id);
  }
}