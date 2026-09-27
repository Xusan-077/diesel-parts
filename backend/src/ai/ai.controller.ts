import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AiService } from './ai.service';
import { TranslateRequestDto } from './dto/translate-request.dto';

/**
 * Manual "check & AI translate" action the /panel forms call before save
 * (and the create/update services call again if the form skipped this
 * step — see products/categories/brands services). Both DIRECTOR and SELLER
 * may create/edit products/categories/brands, so this gates on the same
 * `<module>:write`-shaped permission as the entity itself rather than a
 * role tier — see backend/src/common/permissions.ts.
 */
@Controller('ai')
@UseGuards(JwtAuthGuard, PermissionsGuard, ThrottlerGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('products/translate')
  @RequirePermission('products:update')
  translateProduct(@Body() dto: TranslateRequestDto) {
    return this.ai.translateEntity(dto);
  }

  @Post('categories/translate')
  @RequirePermission('categories:update')
  translateCategory(@Body() dto: TranslateRequestDto) {
    return this.ai.translateEntity(dto);
  }

  @Post('brands/translate')
  @RequirePermission('products:update')
  translateBrand(@Body() dto: TranslateRequestDto) {
    return this.ai.translateEntity(dto);
  }
}
