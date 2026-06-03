import type { WidgetManifest } from '@homeport/ui'
import { LegacyWidget } from '../components/LegacyWidget'
import { TaskOverviewWidget } from '../widgets/vikunja/TaskOverviewWidget'
import { ProjectFocusWidget } from '../widgets/vikunja/ProjectFocusWidget'
import { InventoryOverviewWidget } from '../widgets/inventory/InventoryOverviewWidget'
import { ReadingWidget } from '../widgets/knowledge/ReadingWidget'

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
}
