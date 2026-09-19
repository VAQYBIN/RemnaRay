import { Body, Controller, Post } from '@nestjs/common';

import { UsersService } from './users.service';

@Controller('api/internal/v1/users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post('upsert')
  upsert(@Body() body: unknown) {
    return this.users.upsert(body);
  }
}
