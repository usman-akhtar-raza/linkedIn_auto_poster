import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PromptTemplateService } from '../application/prompt-template.service';
import { CreatePromptTemplateDto } from './dto/create-prompt-template.dto';

@ApiTags('prompts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('prompts')
export class PromptsController {
  constructor(private readonly prompts: PromptTemplateService) {}

  @Get()
  list(@CurrentUser() user: { userId: string }) {
    return this.prompts.list(user.userId);
  }

  @Post()
  create(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreatePromptTemplateDto,
  ) {
    return this.prompts.create(user.userId, dto);
  }
}
