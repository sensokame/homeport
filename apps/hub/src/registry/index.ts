import type { WidgetManifest } from '@homeport/ui'
import { LegacyWidget } from '../components/LegacyWidget'
import { TaskOverviewWidget } from '../widgets/vikunja/TaskOverviewWidget'
import { ProjectFocusWidget } from '../widgets/vikunja/ProjectFocusWidget'
import { InventoryOverviewWidget } from '../widgets/inventory/InventoryOverviewWidget'
import { ReadingWidget } from '../widgets/knowledge/ReadingWidget'
import { InfraWidget } from '../widgets/infra/InfraWidget'
import { FitnessWidget } from '../widgets/fitness/FitnessWidget'
import { BudgetWidget } from '../widgets/budget/BudgetWidget'
import { ConsciousTradeWidget } from '../widgets/calendar/ConsciousTradeWidget'

export const registry: Record<string, WidgetManifest> = {
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
  },
  'inventory.overview': {
    id: 'inventory.overview',
    name: 'Inventory',
    description: 'Stock overview and per-project item needs',
    configSchema: {},
    component: InventoryOverviewWidget,
  },
  'vikunja.task-overview': {
    id: 'vikunja.task-overview',
    name: 'Tasks',
    description: 'All open tasks with per-project pages; highlights overdue and blocked items',
    configSchema: {},
    component: TaskOverviewWidget,
  },
  'vikunja.project-focus': {
    id: 'vikunja.project-focus',
    name: 'Project Focus',
    description: 'Tasks for a single project',
    configSchema: {
      project_id: { type: 'number', label: 'Project ID', required: true },
    },
    component: ProjectFocusWidget,
  },
  'infra.overview': {
    id: 'infra.overview',
    name: 'Infrastructure',
    description: 'CPU, RAM, disk metrics and container status grouped by service group',
    configSchema: {},
    component: InfraWidget,
  },
  'fitness.overview': {
    id: 'fitness.overview',
    name: 'Fitness',
    description: "Today's workout status, active routine, and nutrition log count",
    configSchema: {},
    component: FitnessWidget,
  },
  'budget.overview': {
    id: 'budget.overview',
    name: 'Budget',
    description: 'Current month budget summary — spent vs remaining',
    configSchema: {},
    component: BudgetWidget,
  },
  'calendar.conscious-trade': {
    id: 'calendar.conscious-trade',
    name: 'Conscious Trade',
    description: 'Current calendar block with one-click trade acknowledgment',
    configSchema: {},
    component: ConsciousTradeWidget,
  },
}
