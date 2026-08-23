import { Body, Controller, Post } from '@nestjs/common';
import { InquiriesService } from './inquiries.service';
import { CreateInquiryDto } from './dto/create-inquiry.dto';

/**
 * The public-site inquiry form. No guard: a visitor is not signed in, and
 * the phone submitted here is contact information being recorded, not an
 * identity claim — see the doc comment on `CreateInquiryDto`.
 */
@Controller('inquiries')
export class InquiriesController {
  constructor(private readonly inquiries: InquiriesService) {}

  @Post()
  async create(@Body() dto: CreateInquiryDto) {
    await this.inquiries.create(dto);
    return { success: true };
  }
}
