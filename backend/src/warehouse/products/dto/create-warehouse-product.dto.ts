/**
 * Product create/update from the warehouse panel reuses the catalog DTOs
 * verbatim — one product write contract, whichever panel calls it. Re-exported
 * under warehouse-flavoured names so the controller reads cleanly.
 */
export { CreateProductDto as CreateWarehouseProductDto } from '../../../products/dto/create-product.dto';
export { UpdateProductDto as UpdateWarehouseProductDto } from '../../../products/dto/update-product.dto';
