/* Ponto único de acesso a dados.
   NEXT_PUBLIC_DATA_BACKEND=supabase usa o banco real (precisa das chaves em .env.local); qualquer outro valor usa o
   repositório falso em memória. As telas não mudam: os dois expõem as mesmas funções, e o TypeScript
   recusa a compilação se o real divergir do falso. */
import * as fake from "./fake/repo";
import * as real from "./supabase/repo";

type Repo = Omit<typeof fake, "MANAGES_OWN_SESSION"> & { MANAGES_OWN_SESSION: boolean };
const impl: Repo = process.env.NEXT_PUBLIC_DATA_BACKEND === "supabase" ? real : fake;

export const {
  MANAGES_OWN_SESSION, getSubscription, userBySessionToken, oauthUrl, finishOAuth, signIn, signUp, signOut, deleteAccount, workspacesOf, workspaceForUser, createWorkspace, listUsers, listPipelines, listLossReasons, listTaskTypes, getBoard, listLeads, createLead, updateLead, moveLead, deleteLead, getLead, addNote, createTask, completeTask, listTasks, acceptIncoming, declineIncoming, linkIncoming, listConversations, getConversation, markConversationRead, windowClosed, sendMessage, sendAttachment, attachInbound, getWebchat, visitorThread, receiveInbound, listContacts, getContact, createContact, createCompany, listCompanies, getCompany, listChannels, search, getDashboard,
  fireRobots, tickRobots, fireRobotsForMessage, listRobots, getRobot, saveRobot, setRobotActive, deleteRobot, listTemplates, saveTemplate, deleteTemplate,
  listMembers, addMember, createInvite, listInvites, revokeInvite, getInvite, acceptInvite, acceptInviteNewAccount, setMemberRole, removeMember, listFields, saveField, deleteField, getLeadCustom, setLeadCustom, listTeamMessages, sendTeamMessage, sendTeamAttachment, previewBroadcast, sendBroadcast, listBroadcasts, optOutContact,
  getAccess, getNotificationsSeen, markNotificationsSeen, signupInfo, listMarks, saveMark, deleteMark, connectChannel, disconnectChannel, deliverQueued, updateDeliveryStatus, getAgent, saveAgent, setConversationAi, answerWithAgent, createPipeline, renamePipeline, deletePipeline, addStage, updateStage, deleteStage, setMyAvatar, setWorkspaceLogo,
  attributeInbound, syncLeadAttribution, getLeadAttribution, setLeadAttribution, listTrackingLinks, saveTrackingLink, deleteTrackingLink, clickTrackingLink,
} = impl;
export type { ConvFilter, LeadFilter } from "./fake/repo";
