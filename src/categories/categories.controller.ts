import { Controller, Get, Post, Put, Delete, Param, Body, Req } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  async findAll(@Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.categoriesService.findAll(userId);
  }

  @Post()
  async createCategory(@Body() body: CreateCategoryDto, @Req() req: any) {
    const userId = req.user?.userId || req.user?.sub || body['userId'];
    return this.categoriesService.createCategory(userId, body);
  }

@Post('batch')
  async createBatch(@Body() body: any, @Req() req: any) {
    const userId = req.user?.userId || req.user?.sub || body.userId; 
    if (!userId) throw new Error('Unauthorized');

    // SOLUSI: Tambahkan deklarasi tipe 'any[]' di sini
    let categoriesArray: any[] = []; 
    
    if (Array.isArray(body)) {
      categoriesArray = body;
    } else if (body && Array.isArray(body.categories)) {
      categoriesArray = body.categories;
    } else if (typeof body === 'string') {
      try {
        const parsed = JSON.parse(body);
        categoriesArray = Array.isArray(parsed) ? parsed : (parsed.categories || []);
      } catch (e) {
        categoriesArray = [];
      }
    }

    if (!Array.isArray(categoriesArray) || categoriesArray.length === 0) {
      throw new Error('Payload gagal diproses.');
    }

    return this.categoriesService.createBatch(userId, categoriesArray);
  }
  @Put(':id')
  async updateCategory(@Param('id') id: string, @Body() body: UpdateCategoryDto, @Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.categoriesService.updateCategory(id, userId, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.categoriesService.remove(userId, id);
  }
}