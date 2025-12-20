# Personal KYC Vault - MVP

A secure vault for storing and sharing KYC documents with client-side encryption.

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
```

3. Set up the database:
```bash
pnpm db:generate
pnpm db:push
```

4. Create the storage bucket in Supabase:
   - Go to Storage in your Supabase dashboard
   - Create a bucket named `vault-ciphertext`
   - Set it to private

5. Run the development server:
```bash
pnpm dev
```

## Testing

Run unit tests:
```bash
pnpm test
```

## Project Structure

- `src/app/` - Next.js app router pages and API routes
- `src/lib/` - Shared utilities (crypto, database, storage)
- `src/components/` - React components
- `src/types/` - TypeScript type definitions
- `test/` - Unit tests
- `prisma/` - Database schema

## Security Notes

- Documents are encrypted client-side before upload
- Server never receives plaintext documents
- Vault password is never stored or transmitted to the server
- No password recovery in MVP - losing the password means losing access
