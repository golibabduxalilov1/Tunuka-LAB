import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthUser, User } from '../auth/auth.guard';
import { ProjectsService } from './projects.service';

type ProjectBody = { name?: string; data?: unknown };

@Controller('projects')
@UseGuards(AuthGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@User() u: AuthUser) {
    return this.projects.list(u.id);
  }

  @Post()
  create(@User() u: AuthUser, @Body() b: ProjectBody) {
    return this.projects.create(u.id, b?.name, b?.data);
  }

  @Get(':id')
  get(@User() u: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.projects.get(u.id, id);
  }

  @Put(':id')
  update(@User() u: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() b: ProjectBody) {
    return this.projects.update(u.id, id, b?.name, b?.data);
  }

  @Delete(':id')
  remove(@User() u: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.projects.remove(u.id, id);
  }
}
