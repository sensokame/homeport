import { lazy } from 'react'
import type { WidgetManifest } from '@homeport/ui'
import { ClockWidget } from '../widgets/builtin/ClockWidget'

const CalendarWidget         = lazy(() => import('gcal/CalendarWidget'))
const InfraWidget            = lazy(() => import('infra/InfraWidget'))
const InventoryOverviewWidget = lazy(() => import('inventory/InventoryOverviewWidget'))
const ReadingWidget          = lazy(() => import('knowledge/ReadingWidget'))

export const registry: Record<string, WidgetManifest> = {
  'builtin.clock': {
    id: 'builtin.clock',
    name: 'Clock',
    description: 'Current time display',
    configSchema: {},
    component: ClockWidget,
    defaultIcon: 'clock',
  },
  'knowledge.reading': {
    id: 'knowledge.reading',
    name: 'Reading',
    description: 'Currently reading books with per-book details and vault links',
    configSchema: {},
    component: ReadingWidget,
    defaultIcon: 'book-open',
  },
  'inventory.overview': {
    id: 'inventory.overview',
    name: 'Inventory',
    description: 'Stock overview and per-project item needs',
    configSchema: {},
    component: InventoryOverviewWidget,
    defaultIcon: 'package',
  },
  'infra.overview': {
    id: 'infra.overview',
    name: 'Infrastructure',
    description: 'CPU, RAM, disk metrics and container status grouped by service group',
    configSchema: {},
    component: InfraWidget,
    defaultIcon: 'server',
  },
  'calendar.overview': {
    id: 'calendar.overview',
    name: 'Calendar',
    description: 'Current calendar block with one-click trade acknowledgment',
    configSchema: {},
    component: CalendarWidget,
    defaultIcon: 'calendar',
  },
}
