// Wireframe: docs/wireframes/index.html#av-builder
import { CampaignBuilder } from '../../../components/CampaignBuilder';

export const dynamic = 'force-dynamic';

export default function CampaignsNewPage({ searchParams }: { searchParams: { error?: string } }) {
  return <CampaignBuilder error={searchParams.error} />;
}
