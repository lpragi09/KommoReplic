/* Ponto único de acesso a dados.
   NEXT_PUBLIC_DATA_BACKEND=supabase usa o banco real (precisa das chaves em .env.local); qualquer outro valor usa o
   repositório falso em memória. As telas não mudam: os dois expõem as mesmas funções, e o TypeScript
   recusa a compilação se o real divergir do falso. */
import * as fake from "./fake/repo";
import * as real from "./supabase/repo";

type Repo = Omit<typeof fake, "MANAGES_OWN_SESSION"> & { MANAGES_OWN_SESSION: boolean };
const impl: Repo = process.env.NEXT_PUBLIC_DATA_BACKEND === "supabase" ? real : fake;

export const {
  MANAGES_OWN_SESSION, getSubscription, userBySessionToken, signIn, signUp, signOut, deleteAccount, workspacesOf, workspaceForUser, createWorkspace, listUsers, listPipelines, listLossReasons, listTaskTypes, getBoard, listLeads, createLead, updateLead, moveLead, deleteLead, getLead, addNote, createTask, completeTask, listTasks, acceptIncoming, declineIncoming, linkIncoming, listConversations, getConversation, markConversationRead, windowClosed, sendMessage, getWebchat, visitorThread, receiveInbound, listContacts, getContact, createContact, listCompanies, getCompany, listChannels, search, getDashboard,
} = impl;
export type { ConvFilter, LeadFilter } from "./fake/repo";
