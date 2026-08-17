import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { AdminGuard } from './admin.guard';

@Module({
    providers:[AuthService,AuthGuard,AdminGuard],
    exports:[AuthService,AuthGuard,AdminGuard]
})
export class AuthModule {

}
