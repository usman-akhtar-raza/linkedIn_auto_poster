import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { GenerateDraftDto } from './dto/generate-draft.dto';
import { ListPostsDto } from './dto/list-posts.dto';
import { RejectPostDto } from './dto/reject-post.dto';
import { SchedulePostDto } from './dto/schedule-post.dto';
import { PostsService } from '../application/posts.service';

@ApiTags('posts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  list(@CurrentUser() user: { userId: string }, @Query() query: ListPostsDto) {
    return this.posts.listPaginated(user.userId, query);
  }

  @Post('drafts')
  generateDraft(
    @CurrentUser() user: { userId: string },
    @Body() dto: GenerateDraftDto,
  ) {
    return this.posts.generateDraft(user.userId, dto);
  }

  @Post(':id/approve')
  approve(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.posts.approve(user.userId, id);
  }

  @Post(':id/reject')
  reject(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: RejectPostDto,
  ) {
    return this.posts.reject(user.userId, id, dto.reason);
  }

  @Post(':id/publish')
  publish(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.posts.publish(user.userId, id);
  }

  @Post(':id/schedule')
  schedule(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: SchedulePostDto,
  ) {
    return this.posts.schedule(user.userId, id, dto.scheduledFor);
  }
}
