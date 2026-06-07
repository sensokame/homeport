import { lazy } from 'react'
import type { WidgetManifest } from '@homeport/ui'
import { ClockWidget } from '../widgets/builtin/ClockWidget'
import { LegacyWidget } from '../components/LegacyWidget'

const TaskOverviewWidget     = lazy(() => import('vikunja/TaskOverviewWidget'))
const ProjectFocusWidget     = lazy(() => import('vikunja/ProjectFocusWidget'))
const BudgetWidget           = lazy(() => import('budget/BudgetWidget'))
const CalendarWidget         = lazy(() => import('gcal/CalendarWidget'))
const InfraWidget            = lazy(() => import('infra/InfraWidget'))
const InventoryOverviewWidget = lazy(() => import('inventory/InventoryOverviewWidget'))
const ReadingWidget          = lazy(() => import('knowledge/ReadingWidget'))
const FitnessWidget          = lazy(() => import('wger/FitnessWidget'))

export const registry: Record<string, WidgetManifest> = {
  'builtin.clock': {
    id: 'builtin.clock',
    name: 'Clock',
    description: 'Current time display',
    configSchema: {},
    component: ClockWidget,
    defaultIcon: 'clock',
  },
  'legacy.widget': {
    id: 'legacy.widget',
    name: 'Widget',
    description: 'Calls /widget on the satellite (legacy WidgetData API)',
    configSchema: {
      icon: { type: 'string', label: 'Icon name', required: false },
    },
    component: LegacyWidget,
    fullScreen: true,
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
  'vikunja.task-overview': {
    id: 'vikunja.task-overview',
    name: 'Tasks',
    description: 'All open tasks with per-project pages; highlights overdue and blocked items',
    configSchema: {},
    component: TaskOverviewWidget,
    defaultIcon: 'check-square',
  },
  'vikunja.project-focus': {
    id: 'vikunja.project-focus',
    name: 'Project Focus',
    description: 'Tasks for a single project',
    configSchema: {
      project_id: { type: 'number', label: 'Project ID', required: true },
    },
    component: ProjectFocusWidget,
    defaultIcon: 'folder',
  },
  'infra.overview': {
    id: 'infra.overview',
    name: 'Infrastructure',
    description: 'CPU, RAM, disk metrics and container status grouped by service group',
    configSchema: {},
    component: InfraWidget,
    defaultIcon: 'server',
  },
  'fitness.overview': {
    id: 'fitness.overview',
    name: 'Fitness',
    description: "Today's workout status, active routine, and nutrition log count",
    configSchema: {},
    component: FitnessWidget,
    defaultIcon: 'activity',
  },
  'budget.overview': {
    id: 'budget.overview',
    name: 'Budget',
    description: 'Current month budget summary — spent vs remaining',
    configSchema: {},
    component: BudgetWidget,
    defaultIcon: 'dollar-sign',
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
