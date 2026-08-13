import { PartialType } from '@nestjs/mapped-types';
import { CreateCategoryDto } from './create-category.dto';

// Meminjam semua validasi dari CreateCategoryDto, tetapi membuatnya menjadi opsional (bisa diubah sebagian)
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}