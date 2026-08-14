    import { Controller, Get, Post, Body, Param, Delete, Query, Patch, UseGuards, Req } from '@nestjs/common';
    import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { AuthGuard } from '@nestjs/passport'; // Gunakan bawaan NestJS Passport
import { UpdateCategoryDto } from './dto/update-category.dto';

    @UseGuards(AuthGuard('jwt'))
    @Controller('categories')
    export class CategoriesController {
        transactionsService: any;
    constructor(private readonly categoriesService: CategoriesService) {}

    // GET npx nest generate module transactions?userId=[ID_USER]
    @Get()
    getCategories(@Query('userId') userId: string) {
        return this.categoriesService.getCategoriesByUser(userId);
    }

    // POST http://localhost:3000/categories
    @Post()
    createCategory(@Body() body: { name: string; type: 'INCOME' | 'EXPENSE'; userId: string }) {
        return this.categoriesService.createCategory(body);
    }

    // DELETE http://localhost:3000/categories/[ID_KATEGORI]
    @Delete(':id')
    deleteCategory(@Param('id') id: string) {
        return this.categoriesService.deleteCategory(id);
    }
    // PATCH http://localhost:3000/categories/[ID_KATEGORI]
  @Patch(':id')
  updateCategory(
    @Param('id') id: string,
    @Body() body: { name?: string; type?: 'INCOME' | 'EXPENSE' }
  ) {
    return this.categoriesService.updateCategory(id, body);
  }
// Di dalam categories.controller.ts
@Post('batch')
  async createBatch(@Body() body: any, @Req() req: any) {
    const userId = req.user.userId || req.user.sub;
    
      // [UPDATE MUTLAK]: Ekstrak Array dengan aman. 
      // Jika FE mengirim { categories: [...] }, ambil .categories
    // Jika FE mengirim [...] langsung, gunakan body
    const categoriesArray = Array.isArray(body) ? body : (body.categories || []);

    if (categoriesArray.length === 0) {
      throw new Error('Data kategori kosong atau format tidak sesuai ekspektasi');
    }

    return this.categoriesService.createBatch(userId, categoriesArray);
  }   
  // Jangan lupa mengimpor UpdateCategoryDto dan Param di bagian atas
  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @Req() req: any
  ) {
    const userId = req.user.userId || req.user.sub;
    return this.categoriesService.update(id, updateCategoryDto, userId);
  }
    }