import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { InternalTokenGuard } from '../auth/auth.guards';
import { UsersService } from './users.service';

@Controller('api/internal/v1/users')
@UseGuards(InternalTokenGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post('upsert')
  upsert(@Body() body: unknown) {
    return this.users.upsert(body);
  }
}
