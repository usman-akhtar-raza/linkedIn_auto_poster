import { Module } from '@nestjs/common';
import { MemoryService } from './application/memory.service';
import { MemoryController } from './presentation/memory.controller';

@Module({
  controllers: [MemoryController],
  providers: [MemoryService],
  exports: [MemoryService],
})
export class MemoryModule {}
