import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      driver: require('mysql2'),
      host: 'localhost',
      port: 3306,
      username: 'yg',
      password: '12345',
      database: 'payments',
      synchronize: true,
      autoLoadEntities: true,
    }),
  ],
  exports: [TypeOrmModule],
})
export class DbConfigModule {}

