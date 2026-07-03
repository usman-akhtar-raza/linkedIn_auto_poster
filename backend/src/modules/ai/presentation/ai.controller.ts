import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { ResearchService } from '../application/research.service';
import { WriterService } from '../application/writer.service';
import { EditorService } from '../application/editor.service';
import { ImagePromptService } from '../application/image-prompt.service';
import { GeneratePostDto } from './dto/generate-post.dto';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/ai')
export class AiController {
  constructor(
    private readonly research: ResearchService,
    private readonly writer: WriterService,
    private readonly editor: EditorService,
    private readonly imagePrompt: ImagePromptService,
  ) {}

  @Post('research')
  researchTopics() {
    return this.research.searchLatestTrends();
  }

  @Post('generate-post')
  async generatePost(
    @CurrentUser() user: { userId: string },
    @Body() dto: GeneratePostDto,
  ) {
    const draft = await this.writer.generatePost({
      userId: user.userId,
      topic: dto.topic,
      audience: dto.audience,
    });
    const edited = await this.editor.polish(draft);
    const imagePrompt = dto.includeImage
      ? await this.imagePrompt.createPrompt(dto.topic, edited)
      : null;

    return { draft: edited, imagePrompt };
  }
}
