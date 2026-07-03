import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LinkedinOAuthService } from './application/linkedin-oauth.service';
import { LinkedinPublisherService } from './application/linkedin-publisher.service';
import { LinkedinController } from './presentation/linkedin.controller';

@Module({
  imports: [HttpModule],
  controllers: [LinkedinController],
  providers: [LinkedinOAuthService, LinkedinPublisherService],
  exports: [LinkedinOAuthService, LinkedinPublisherService],
})
export class LinkedinModule {}
