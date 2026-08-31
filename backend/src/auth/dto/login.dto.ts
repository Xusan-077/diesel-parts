import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  /**
   * Despite the name, this accepts either a phone number or an email
   * address — kept as `phone` (not renamed to `identifier`) because the
   * seller panel's login request already sends `{ phone, password }`
   * literally (see `lib/api/seller-panel/auth.ts`), and renaming the field
   * here would be an out-of-scope breaking change to that call site.
   */
  @IsString()
  @MinLength(1)
  phone: string;

  @IsString()
  @MinLength(6)
  password: string;
}
