    import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
    import { Reflector } from '@nestjs/core';
    import { AuthGuard } from '@nestjs/passport';
    import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

    @Injectable()
    export class JwtAuthGuard extends AuthGuard('jwt') {
    constructor(private reflector: Reflector) {
        super();
    }

    canActivate(context: ExecutionContext) {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
        ]);
        
        // Jika rute memiliki dekorator @Public(), izinkan akses tanpa token
        if (isPublic) {
        return true;
        }
        
        // Jika tidak, jalankan validasi JWT standar
        return super.canActivate(context);
    }

    handleRequest(err: any, user: any, info: any) {
        if (err || !user) {
        throw err || new UnauthorizedException('Akses ditolak. Token tidak valid atau kadaluarsa.');
        }
        return user;
    }
    }