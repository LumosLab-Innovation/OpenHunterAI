-- Adds the recon-worker step kind (subfinder/dnsx/httpx/katana signal layer).
-- Additive-only: existing rows and enum ordinals are untouched.
ALTER TYPE "ScanStepKind" ADD VALUE 'recon_signal';
