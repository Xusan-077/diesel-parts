import { PartialType } from '@nestjs/mapped-types';
import { CreateGoodsReceiptDto } from './create-goods-receipt.dto';

/**
 * Every field optional. When `items` is present it replaces the whole line set
 * (and the totals are recomputed); when absent the existing lines are kept.
 * Only a `DRAFT` receipt may be updated.
 */
export class UpdateGoodsReceiptDto extends PartialType(CreateGoodsReceiptDto) {}
