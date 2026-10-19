import { Suspense } from "react";
import { getInvite } from "@/data";
import { currentUser } from "@/data/session";
import { InviteScreen } from "@/components/auth/invite";

export const metadata = { title: "Convite", robots: { index: false } };

async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = /^[A-Za-z0-9_-]{20,60}$/.test(token);
  const [invite, user] = await Promise.all([valid ? getInvite(token) : null, currentUser()]);
  return <InviteScreen token={token} invite={invite} me={user ? { email: user.email } : null} />;
}

export default function InvitePage({ params }: PageProps<"/convite/[token]">) {
  return (
    <Suspense fallback={null}>
      <Invite params={params as Promise<{ token: string }>} />
    </Suspense>
  );
}
