import { Module } from '@nestjs/common';
import { JobsService } from './application/jobs.service';

@Module({
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
