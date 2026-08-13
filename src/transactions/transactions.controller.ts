    import { Controller, Get, Post, Body, Param, Delete, Query, Patch, UseGuards } from '@nestjs/common';
    import { CategoryType } from '@prisma/client';
    import { AuthGuard } from '@nestjs/passport';
    import { TransactionsService } from './transactions.service';

    @UseGuards(AuthGuard('jwt'))
    @Controller('transactions')
    export class TransactionsController {
    constructor(private readonly transactionsService: TransactionsService) {}

    // GET http://localhost:3000/transactions?userId=[ID_USER]
    @Get()
    getTransactions(@Query('userId') userId: string) {
        return this.transactionsService.getTransactionsByUser(userId);
    }

    // POST http://localhost:3000/transactions
    @Post()
    createTransaction(
        @Body() body: { amount: number; description?: string; userId: string; categoryId: string; type?: CategoryType }
    ) {
        return this.transactionsService.createTransaction(body);
    }

    // DELETE http://localhost:3000/transactions/[ID_TRANSAKSI]
    @Delete(':id')
    deleteTransaction(@Param('id') id: string) {
        return this.transactionsService.deleteTransaction(id);
    }
        // PATCH http://localhost:3000/transactions/[ID_TRANSAKSI]
  @Patch(':id')
  updateTransaction(
    @Param('id') id: string,
    @Body() body: { amount?: number; description?: string; categoryId?: string; type?: CategoryType }
  ) {
    return this.transactionsService.updateTransaction(id, body);
  }

    }