import { IsNumber, IsString, IsIn, IsOptional, IsDateString } from 'class-validator';

export class UpdateTransactionDto {
  @IsNumber()
  @IsOptional()
  amount?: number;

  @IsString()
  @IsIn(['INCOME', 'EXPENSE'])
  @IsOptional()
  type?: 'INCOME' | 'EXPENSE';

  @IsDateString()
  @IsOptional()
  date?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;
}