import { Controller, Get, Param, Patch, Post, Delete, Req, Body, UnauthorizedException, InternalServerErrorException, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { PlanType } from '@prisma/client';
import { AuthGuard } from '@nestjs/passport';
import { SkipPlanStatus } from '../auth/decorators/skip-plan-status.decorator';
import { PlanStatusGuard } from '../auth/guards/plan-status.guard';

@Controller('users')
@UseGuards(PlanStatusGuard)
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
  @SkipPlanStatus()
  async updatePlan(@Req() req, @Body() body: { plan: string; days?: number }) {
    const userId = this.extractUserId(req);
    const targetPlan = body.plan as PlanType;

    if (!['FREE', 'PRO', 'PLATINUM'].includes(targetPlan)) {
      throw new UnauthorizedException('Plan tidak valid. Gunakan: FREE, PRO, atau PLATINUM');
    }

    try {
      const updatedUser = await this.usersService.updatePlan(userId, targetPlan, body.days);
      return {
        success: true,
        message: body.days && targetPlan === 'FREE'
          ? `Plan FREE + trial diperpanjang ${body.days} hari. Trial berakhir ${updatedUser.trialEndsAt}`
          : `Plan berhasil diubah menjadi ${targetPlan}`,
        data: {
          plan: updatedUser.plan,
          trialEndsAt: updatedUser.trialEndsAt,
        },
      };
    } catch (error: any) {
      throw new InternalServerErrorException('Gagal mengubah plan di database');
    }
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getProfile(@Req() req) {
    const userId = this.extractUserId(req);
    const result = await this.usersService.getProfile(userId);
    console.log(`[CCTV GET /me] plan user di DB adalah: ${result?.data?.plan ?? 'UNKNOWN'}`);
    return result;
  }

  @Patch('me')
  @UseGuards(AuthGuard('jwt'))
  @SkipPlanStatus()
  async updateProfile(@Req() req, @Body() body: { firstName?: string; lastName?: string; name?: string }) {
    const userId = this.extractUserId(req);
    return this.usersService.updateProfile(userId, body);
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

}
