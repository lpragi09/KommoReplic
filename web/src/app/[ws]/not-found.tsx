import Link from "next/link";
import { SearchX } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/bits";

export default function NotFound() {
  return (
    <div className="grid flex-1 place-items-center">
      <EmptyState
        icon={SearchX}
        title="Não encontramos esta página"
        text="O item pode ter sido excluído, ou você não tem acesso a ele."
        action={<Link href="/" className="text-sm font-medium text-accent-text underline">Voltar ao início</Link>}
      />
    </div>
  );
}
