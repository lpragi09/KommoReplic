import type { CSSProperties } from "react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="fx-aurora grid min-h-dvh place-items-center px-4">
      <span aria-hidden className="fx-backword left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        404
      </span>
      <div className="relative z-10 max-w-md text-center">
        <h1 className="fx-rise fx-gradient-text text-xl">Não encontramos esta página</h1>
        <p className="fx-rise mt-2 text-base text-on-night-muted" style={{ "--d": 1 } as CSSProperties}>
          O endereço pode estar errado, o item pode ter sido excluído ou você não tem acesso a ele.
        </p>
        <Link
          href="/"
          className="fx-rise fx-shine fx-glow mt-6 inline-flex h-10 items-center rounded-sm bg-accent px-5 text-base font-medium text-on-accent"
          style={{ "--d": 2 } as CSSProperties}
        >
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
