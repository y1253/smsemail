import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  @MaxLength(145)
  first_name!: string;

  @IsString()
  @MaxLength(145)
  @IsOptional()
  last_name?: string;
}
