import {
  Book, BookOpen, CheckSquare, DollarSign, Server, Package,
  Globe, Database, Folder, Settings, Activity, type LucideProps,
} from 'lucide-react'

type IconComponent = React.ComponentType<LucideProps>

const ICON_MAP: Record<string, IconComponent> = {
  'book':         Book,
  'book-open':    BookOpen,
  'check-square': CheckSquare,
  'dollar-sign':  DollarSign,
  'server':       Server,
  'package':      Package,
  'globe':        Globe,
  'database':     Database,
  'folder':       Folder,
  'settings':     Settings,
  'activity':     Activity,
}

export function resolveIcon(name: string | undefined): React.ReactNode {
  if (!name) return undefined
  const Icon = ICON_MAP[name]
  return Icon ? <Icon size={20} strokeWidth={1.5} /> : undefined
}
