import { IsNotEmpty, IsString } from 'class-validator';

export class ConnectGoogleEmailDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}

