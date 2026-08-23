import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestWithVerifiedPhone } from '../guards/internal-service.guard';

/**
 * The phone `InternalServiceGuard` verified for this request. Only meaningful
 * on a route that also carries `@UseGuards(InternalServiceGuard)` — without
 * it, `request.verifiedPhone` was never set.
 */
export const VerifiedPhone = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<RequestWithVerifiedPhone>();
    return request.verifiedPhone as string;
  },
);
