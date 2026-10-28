import "server-only";
import { platform as fake } from "./fake";
import { platform as real } from "./supabase";
import type { PlatformRepo } from "./types";

/** central da plataforma: banco real com Supabase, em memória no desenvolvimento */
export const platform: PlatformRepo = process.env.NEXT_PUBLIC_DATA_BACKEND === "supabase" ? real : fake;
export type * from "./types";
