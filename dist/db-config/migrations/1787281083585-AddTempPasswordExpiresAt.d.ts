import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class AddTempPasswordExpiresAt1787281083585 implements MigrationInterface {
    name: string;
    private hasColumn;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
