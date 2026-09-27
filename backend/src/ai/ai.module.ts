import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { GeminiService } from './gemini.service';

@Module({
  imports: [
    // Scoped to this module only — the AI translate endpoints are the one
    // place in the API that calls an external, rate-limited paid service.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
  ],
  controllers: [AiController],
  providers: [AiService, GeminiService],
  exports: [AiService],
})
export class AiModule {}
