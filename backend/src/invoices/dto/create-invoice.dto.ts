import { IsString } from 'class-validator';

export class CreateInvoiceDto {
  @IsString()
  orderId: string;
}
