import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/States';

export function NotFoundPage() {
  return (
    <Card className="mt-10">
      <EmptyState icon={Compass} title="Page not found" description="The page you’re looking for doesn’t exist." action={<Link to="/" className="text-sm text-accent hover:underline">Go to overview</Link>} />
    </Card>
  );
}
