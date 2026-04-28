// components/Icon.tsx
// Tunn wrapper kring lucide-react-native så vi har EN central plats för ikoner.
// Alla ikoner lever i appen som vektorer — inga emoji-platshållare i UI.

import { ComponentProps } from 'react';
import {
  Home, ListChecks, Plus, BarChart3, Settings, Search, Filter,
  ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, Calendar, Receipt,
  Camera, Image as ImageIcon, X, Check, ChevronLeft, ChevronRight, ChevronDown,
  Trash2, Pencil, Lock, Users, Sparkles, Repeat, Send, MoreHorizontal,
  TrendingUp, TrendingDown, AlertCircle, CheckCircle2, Inbox,
  Coffee, ShoppingCart, Car, Home as HomeIcon, Utensils, Plane, Heart, Gift, Briefcase,
} from 'lucide-react-native';
import { colors } from '@/constants/theme';

const REGISTRY = {
  // Navigation & tabs
  home: Home,
  expenses: ListChecks,
  add: Plus,
  stats: BarChart3,
  settings: Settings,
  swipe: Inbox,

  // Allmänt
  search: Search,
  filter: Filter,
  calendar: Calendar,
  receipt: Receipt,
  camera: Camera,
  image: ImageIcon,
  close: X,
  check: Check,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  chevronDown: ChevronDown,
  trash: Trash2,
  edit: Pencil,
  lock: Lock,
  users: Users,
  ai: Sparkles,
  repeat: Repeat,
  send: Send,
  more: MoreHorizontal,

  // Pengar
  arrowIn: ArrowDownCircle,
  arrowOut: ArrowUpCircle,
  swap: ArrowLeftRight,
  trendUp: TrendingUp,
  trendDown: TrendingDown,

  // Status
  warning: AlertCircle,
  success: CheckCircle2,

  // Kategori-fallbacks (om man vill mappa kategorier till lucide istället för emoji)
  catFood: Utensils,
  catCoffee: Coffee,
  catGroceries: ShoppingCart,
  catTransport: Car,
  catHome: HomeIcon,
  catTravel: Plane,
  catHealth: Heart,
  catGift: Gift,
  catWork: Briefcase,
} as const;

export type IconName = keyof typeof REGISTRY;

type LucideProps = ComponentProps<typeof Home>;

type Props = Omit<LucideProps, 'color' | 'size'> & {
  name: IconName;
  size?: number;
  color?: string;
  /** Sätter strokeWidth — default 2. Använd 1.5 för tunnare. */
  weight?: number;
};

export function Icon({ name, size = 22, color = colors.textPrimary, weight = 2, ...rest }: Props) {
  const Cmp = REGISTRY[name];
  return <Cmp size={size} color={color} strokeWidth={weight} {...rest} />;
}
