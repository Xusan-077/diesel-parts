import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiFillDto } from './dto/ai-fill.dto';
import { AiGenerateImageDto } from './dto/ai-generate-image.dto';
import { InternalRequestGuard } from '../common/guards/internal-request.guard';

/**
 * Reached only by the Next.js director panel's own `/api/v1/products/ai-fill`
 * and `/api/v1/products/ai-generate-image` routes — never directly by a
 * browser. `InternalRequestGuard` checks that the caller holds
 * `INTERNAL_SERVICE_SECRET`; director-level authorization already happened
 * in Next.js's `authenticateDirector()` before that call was made.
 */
@Controller('internal/products')
@UseGuards(InternalRequestGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('ai-fill')
  fill(@Body() dto: AiFillDto) {
    return this.ai.fillFromOem(dto);
  }

  @Post('ai-generate-image')
  generateImage(@Body() dto: AiGenerateImageDto) {
    return this.ai.generateImage(dto);
  }
}
