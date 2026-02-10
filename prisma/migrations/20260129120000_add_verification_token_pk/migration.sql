-- AlterTable: Add primary key to VerificationToken to match Auth.js PrismaAdapter schema.
-- The table had a unique constraint on (identifier, token); we replace it with a primary key.
ALTER TABLE "VerificationToken" DROP CONSTRAINT IF EXISTS "VerificationToken_identifier_token_key";
ALTER TABLE "VerificationToken" ADD PRIMARY KEY ("identifier", "token");
