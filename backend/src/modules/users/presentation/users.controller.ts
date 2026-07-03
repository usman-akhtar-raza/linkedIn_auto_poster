import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { UsersService } from '../application/users.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: { userId: string }) {
    return this.users.getProfile(user.userId);
  }

  @Patch('me/preferences')
  updatePreferences(
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.users.updatePreferences(user.userId, dto);
  }
}
