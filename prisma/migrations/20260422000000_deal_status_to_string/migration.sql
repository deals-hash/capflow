-- AlterTable: change Deal.status from DealStatus enum to plain text
ALTER TABLE "Deal" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Deal" ALTER COLUMN "status" TYPE TEXT;
ALTER TABLE "Deal" ALTER COLUMN "status" SET DEFAULT 'Offer Created';

-- DropEnum
DROP TYPE IF EXISTS "DealStatus";
