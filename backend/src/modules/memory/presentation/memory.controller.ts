import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { MemoryService } from '../application/memory.service';
import { RememberDto } from './dto/remember.dto';

@ApiTags('memory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('memory')
export class MemoryController {
  constructor(private readonly memory: MemoryService) {}

  @Post()
  remember(@CurrentUser() user: { userId: string }, @Body() dto: RememberDto) {
    return this.memory.remember(user.userId, dto);
  }
}
