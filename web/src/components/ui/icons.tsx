/* Ícones do produto: Phosphor (traço fino e preciso), num só lugar.
   Os nomes seguem os que o código já usava, então trocar um ícone é mexer só aqui.
   Usa a entrada /ssr: funciona em componentes de servidor e de cliente, sem contexto.
   Peso padrão "regular" no app; a landing passa weight="light". */
import type { ComponentType } from "react";
import type { IconProps, IconWeight } from "@phosphor-icons/react";
import * as P from "@phosphor-icons/react/ssr";

export type LucideIcon = ComponentType<IconProps>;
export type { IconWeight };

function icon(Ph: ComponentType<IconProps>, defaultWeight: IconWeight = "regular"): LucideIcon {
  const C = ({ weight = defaultWeight, ...rest }: IconProps) => <Ph weight={weight} {...rest} />;
  C.displayName = Ph.displayName;
  return C;
}

export const AlarmClock = icon(P.Alarm);
export const AlertTriangle = icon(P.Warning);
export const TriangleAlert = icon(P.Warning);
export const ArrowLeft = icon(P.ArrowLeft);
export const ArrowRight = icon(P.ArrowRight);
export const ArrowUpRight = icon(P.ArrowUpRight);
export const ArrowRightLeft = icon(P.ArrowsLeftRight);
export const Bell = icon(P.BellSimple);
export const Bot = icon(P.Robot);
export const Building2 = icon(P.Buildings);
export const CalendarCheck = icon(P.CalendarCheck);
export const CalendarDays = icon(P.CalendarDots);
export const ChartColumn = icon(P.ChartBar);
export const Check = icon(P.Check, "bold");
export const CheckCheck = icon(P.Checks, "bold");
export const ChevronRight = icon(P.CaretRight);
export const ChevronsLeft = icon(P.CaretDoubleLeft);
export const ChevronsRight = icon(P.CaretDoubleRight);
export const CircleCheck = icon(P.CheckCircle, "fill");
export const Clock = icon(P.Clock);
export const Columns3 = icon(P.Kanban);
export const Contact = icon(P.AddressBook);
export const Download = icon(P.DownloadSimple);
export const CreditCard = icon(P.CreditCard);
export const ExternalLink = icon(P.ArrowSquareOut);
export const Eye = icon(P.Eye);
export const FileText = icon(P.FileText);
export const Filter = icon(P.FunnelSimple);
export const Fingerprint = icon(P.Fingerprint);
export const GripVertical = icon(P.DotsSixVertical, "bold");
export const GoogleLogo = icon(P.GoogleLogo, "bold");
export const House = icon(P.HouseSimple);
export const ImageIcon = icon(P.Image);
export const Inbox = icon(P.Tray);
export const Lightning = icon(P.Lightning);
export const Link2 = icon(P.LinkSimple);
export const ListPlus = icon(P.ListPlus);
export const Loader2 = icon(P.CircleNotch, "bold");
export const LogOut = icon(P.SignOut);
export const Mail = icon(P.EnvelopeSimple);
export const MessageCircle = icon(P.ChatCircle);
export const MessageSquare = icon(P.ChatsCircle);
export const Mic = icon(P.Microphone);
export const MoreHorizontal = icon(P.DotsThree, "bold");
export const Paperclip = icon(P.Paperclip);
export const Pencil = icon(P.PencilSimple);
export const Phone = icon(P.Phone);
export const Plus = icon(P.Plus, "bold");
export const Radio = icon(P.Broadcast);
export const Search = icon(P.MagnifyingGlass);
export const SearchX = icon(P.MagnifyingGlassMinus);
export const Send = icon(P.PaperPlaneTilt, "fill");
export const Settings = icon(P.GearSix);
export const Smile = icon(P.Smiley);
export const Sparkle = icon(P.Sparkle);
export const StickyNote = icon(P.Note);
export const Trash2 = icon(P.Trash);
export const TrendingDown = icon(P.TrendDown);
export const TrendingUp = icon(P.TrendUp);
export const Trophy = icon(P.Trophy);
export const Upload = icon(P.UploadSimple);
export const UserPlus = icon(P.UserPlus);
export const Users = icon(P.UsersThree);
export const Workflow = icon(P.FlowArrow);
export const X = icon(P.X, "bold");
export const XCircle = icon(P.XCircle);

/* robôs e canais */
export const ChevronDown = icon(P.CaretDown);
export const ChevronUp = icon(P.CaretUp);
export const Copy = icon(P.Copy);
export const Globe = icon(P.Globe);
export const Hourglass = icon(P.HourglassMedium);
export const InstagramLogo = icon(P.InstagramLogo);
export const MessengerLogo = icon(P.MessengerLogo);
export const Play = icon(P.Play, "fill");
export const TagIcon = icon(P.Tag);
export const WhatsappLogo = icon(P.WhatsappLogo);
export const ChatText = icon(P.ChatText);
export const Megaphone = icon(P.Megaphone);
export const SlidersHorizontal = icon(P.SlidersHorizontal);
export const ChartPie = icon(P.ChartPieSlice);
export const Funnel = icon(P.Funnel);
export const UserGear = icon(P.UserGear);
export const Textbox = icon(P.Textbox);
export const At = icon(P.At);

export const Minus = icon(P.Minus, "bold");
export const ArrowsOut = icon(P.CornersOut);
export const KanbanIcon = icon(P.Kanban);
export const ListBullets = icon(P.ListBullets);
export const CaretUpDown = icon(P.CaretUpDown, "bold");
export const UserCircle = icon(P.UserCircle);
export const Coins = icon(P.Coins);
export const Briefcase = icon(P.Briefcase);
