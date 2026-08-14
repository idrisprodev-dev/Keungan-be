import { Body, Controller, Get, Param, Patch, Post, UseGuards, UsePipes, Delete, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';

@UseGuards(AuthGuard('jwt'))
@Controller('users') // Ini berarti endpoint-nya adalah http://localhost:3000/users
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getAllUsers() {
    return this.usersService.getAllUsers();
  }
  @Post()
  createUser(@Body() body: { name: string; email: string }) {
    return this.usersService.createUser(body);
  }
  @Patch(':id')
  updateUser(
    @Param('id') id: string,
    @Body() body: { name?: string; plan?: 'TRIAL' | 'PRO' | 'PLATINUM' },
  ) {
    return this.usersService.updateUser(id, body);
  }

  // Menangkap request DELETE ke http://localhost:3000/users/[ID_USER]
  @Delete(':id')
  deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }
  @Get('me')
  async getMe(@Req() req: any) {
    // Karena aplikasi sudah dilindungi oleh JwtAuthGuard (Step 10), 
    // req.user pasti berisi payload dari JWT yang valid.
    const userId = req.user?.userId || req.user?.sub;
    
    if (!userId) {
      throw new Error('Sesi tidak valid.');
    }

    return this.usersService.getProfile(userId);
  }
}