import { IsNotEmpty, IsNumber, IsString, Min, Max, IsOptional } from 'class-validator';

export class CreateBudgetDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  amount!: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(12)
  month!: number;

  @IsNotEmpty()
  @IsNumber()
  year!: number;

  @IsNotEmpty()
  @IsString()
  categoryId!: string;
}

export class UpdateBudgetDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;

  @IsOptional()
  @IsString()
  categoryId?: string;
}