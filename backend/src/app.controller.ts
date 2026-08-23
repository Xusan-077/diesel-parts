import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'diesel-parts-backend',
      time: new Date().toISOString(),
    };
  }
}
