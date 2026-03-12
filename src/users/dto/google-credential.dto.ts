import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleCredentialDto {
  @IsString()
  @IsNotEmpty({ message: 'credential is required' })
  credential!: string;
}
