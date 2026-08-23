import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  slug: string;

  @IsString()
  @MinLength(1)
  nameUz: string;

  @IsString()
  @MinLength(1)
  nameRu: string;

  @IsString()
  @MinLength(1)
  nameEn: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  /** Part family this branch belongs to - "engine", "brakes", "filters". Defaults to "general". */
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsInt()
  order?: number;
}
