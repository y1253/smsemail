import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListInvoicesDto {
  /**
   * Query params arrive as strings; the global ValidationPipe runs with
   * `transform: true`, so @Type is what makes @IsInt pass for `?limit=12`.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  /** Stripe cursor — the id of the last invoice on the previous page. */
  @IsOptional()
  @IsString()
  startingAfter?: string;
}
