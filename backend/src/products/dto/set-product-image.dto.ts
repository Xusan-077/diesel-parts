import { IsString, MinLength } from 'class-validator';

/** Persists a URL only — the file itself is uploaded and stored by the Next.js side. */
export class SetProductImageDto {
  @IsString()
  @MinLength(1)
  imageUrl: string;
}
