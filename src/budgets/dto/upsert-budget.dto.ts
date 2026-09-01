    // budgets/dto/upsert-budget.dto.ts  ← FILE BARU
import { IsInt, IsNotEmpty, IsNumber, IsPositive, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpsertBudgetDto {
  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  amount!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month!: number;

  @IsInt()
  @Min(2020)
  @Max(2100)
  @Type(() => Number)
  year!: number;
}