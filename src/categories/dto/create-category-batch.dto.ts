import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateCategoryDto } from './create-category.dto'; 

export class CreateCategoryBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCategoryDto) 
  categories!: CreateCategoryDto[]; 
}