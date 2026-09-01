import { Controller, Get, Param, Patch, Post, Delete, Req, Body, UnauthorizedException, InternalServerErrorException, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { PlanType } from '@prisma/client';
import { AuthGuard } from '@nestjs/passport';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private extractUserId(req: any): string {
    const userId = req.user?.id || req.user?.sub || req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Token user tidak valid atau ID tidak ditemukan.');
    }
    return userId;
  }

  @Get()
  getAllUsers() {
    return this.usersService.getAllUsers();
  }

  @Post()
  createUser(@Body() body: { name: string; email: string }) {
    return this.usersService.createUser(body);
  }

    @Patch('dev-update-plan')
  async updatePlan(@Req() req, @Body() body: { plan: string }) {
    const userId = this.extractUserId(req);
    const targetPlan = body.plan as PlanType;

    if (!['FREE', 'PRO', 'PLATINUM'].includes(targetPlan)) {
      throw new UnauthorizedException('Plan tidak valid. Gunakan: FREE, PRO, atau PLATINUM');
    }

    console.log(`[CCTV PATCH] Mengubah plan user ${userId} menjadi: ${targetPlan}`);

    try {
      const updatedUser = await this.usersService.updatePlan(userId, targetPlan);
      console.log(`[CCTV PATCH] SUKSES! Plan diubah ke: ${updatedUser.plan}`);
      return {
        success: true,
        message: `Plan berhasil diubah menjadi ${targetPlan}`,
        data: updatedUser,
      };
    } catch (error: any) {
      console.log(`[CCTV PATCH] GAGAL UPDATE DATABASE:`, error.message);
      throw new InternalServerErrorException('Gagal mengubah plan di database');
    }
  }


  @Patch(':id')
  updateUser(
    @Param('id') id: string,
    @Body() body: { name?: string; plan?: string },
  ) {
    return this.usersService.updateUser(id, body);
  }

  @Delete(':id')
  deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getProfile(@Req() req) {
    const userId = this.extractUserId(req);
    const result = await this.usersService.getProfile(userId);
    console.log(`[CCTV GET /me] plan user di DB adalah: ${result?.data?.plan ?? 'UNKNOWN'}`);
    return result;
  }

}
