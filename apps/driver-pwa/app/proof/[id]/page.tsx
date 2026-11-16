// Wireframe: docs/wireframes/index.html#dr-proof
import Link from 'next/link';
import { stopById } from '../../../lib/daypack';
import { loadDayPack } from '../../../lib/gateway';
import { ProofForm } from '../../../components/ProofForm';

export const dynamic = 'force-dynamic';

export default async function ProofIdPage({ params }: { params: { id: string } }) {
  const pack = await loadDayPack();
  const stop = stopById(pack, params.id);

  if (!stop) {
    return (
      <section>
        <h1>Proof</h1>
        <p className="p">Stop not found in today&apos;s day pack.</p>
        <Link className="btn" href="/">Back to day pack</Link>
      </section>
    );
  }

  return <ProofForm stop={stop} />;
}
