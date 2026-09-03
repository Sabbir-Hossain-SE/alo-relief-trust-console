import { redirect } from 'next/navigation';
import { toSearchParams } from '@/server/api-contract';

/**
 * The review queue, for now, is the documents view filtered to review tasks.
 *
 * A redirect rather than a copy of the grid: one filtered view is the same
 * screen, and duplicating it would mean two places to keep correct. A queue
 * with its own affordances replaces this when the correction form lands.
 */
export default function ReviewPage() {
  redirect(`/documents?${toSearchParams({ status: ['needs_review'] }).toString()}`);
}
