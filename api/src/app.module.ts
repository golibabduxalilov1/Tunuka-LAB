import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DbService, jwtSecret } from './db.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { ProjectsController } from './projects/projects.controller';
import { ProjectsService } from './projects/projects.service';
import { HealthController } from './health.controller';

@Module({
  imports: [JwtModule.register({ global: true, secret: jwtSecret(), signOptions: { expiresIn: '30d' } })],
  controllers: [AuthController, ProjectsController, HealthController],
  providers: [DbService, AuthService, ProjectsService],
})
export class AppModule {}
