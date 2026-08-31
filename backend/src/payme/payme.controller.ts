import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { PaymeService } from './payme.service';
import { PaymeAuthGuard } from './payme-auth.guard';

interface JsonRpcRequest {
  method: string;
  params: Record<string, unknown>;
  id: number | string;
}

/**
 * The single URL registered in Payme's merchant cabinet. Payme sends every
 * Merchant API call here as a JSON-RPC 2.0 envelope; this dispatches on
 * `method` and always echoes the request `id` back, per the protocol.
 */
@Controller('payme')
@UseGuards(PaymeAuthGuard)
export class PaymeController {
  constructor(private readonly payme: PaymeService) {}

  @Post()
  async handle(@Body() body: JsonRpcRequest) {
    const outcome = await this.dispatch(body.method, body.params ?? {});
    return { jsonrpc: '2.0', id: body.id, ...outcome };
  }

  private dispatch(method: string, params: Record<string, unknown>) {
    switch (method) {
      case 'CheckPerformTransaction':
        return this.payme.checkPerformTransaction(params as never);
      case 'CreateTransaction':
        return this.payme.createTransaction(params as never);
      case 'PerformTransaction':
        return this.payme.performTransaction(params as never);
      case 'CancelTransaction':
        return this.payme.cancelTransaction(params as never);
      case 'CheckTransaction':
        return this.payme.checkTransaction(params as never);
      default:
        return Promise.resolve({
          error: { code: -32601, message: 'Method not found' },
        });
    }
  }
}
