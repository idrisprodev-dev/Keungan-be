    import { IsNumber, IsString, IsEnum, IsOptional, IsDateString, Min } from 'class-validator';

    export enum TransactionType {
    INCOME = 'INCOME',
    EXPENSE = 'EXPENSE',
    }

    export class CreateTransactionDto {
    @IsNumber({}, { message: 'Amount harus berupa angka' })
    @Min(1, { message: 'Nominal transaksi minimal 1' })
    amount!: number;

    @IsEnum(TransactionType, { message: 'Type harus bernilai INCOME atau EXPENSE' })
    type!: TransactionType;

    @IsOptional()
    @IsString()
    categoryId?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsDateString({}, { message: 'Format date harus ISO8601 (Contoh: 2026-08-18T10:00:00Z)' })
    date?: string;
    }