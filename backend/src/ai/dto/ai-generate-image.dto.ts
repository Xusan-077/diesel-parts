import { IsOptional, IsString, MinLength } from 'class-validator';

export class AiGenerateImageDto {
  @IsString()
  @MinLength(1)
  productName: string;

  @IsOptional()
  @IsString()
  oemNumber?: string;
}
