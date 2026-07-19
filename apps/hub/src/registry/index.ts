import { lazy } from 'react'
import type { WidgetManifest } from '@homeport/ui'
import { ClockWidget } from '../widgets/builtin/ClockWidget'

const CalendarWidget         = lazy(() => import('gcal/CalendarWidget'))
const InfraWidget            = lazy(() => import('infra/InfraWidget'))
const InventoryOverviewWidget = lazy(() => import('inventory/InventoryOverviewWidget'))
const InventoryProjectItemsWidget = lazy(() => import('inventory/ProjectItemsWidget'))
const ReadingWidget          = lazy(() => import('knowledge/ReadingWidget'))
const KnowledgeProjectTasksWidget = lazy(() => import('knowledge/ProjectTasksWidget'))
const WritingWidget          = lazy(() => import('knowledge/WritingWidget'))
const MusicWidget            = lazy(() => import('knowledge/MusicWidget'))
const WorkspacePanelWidget   = lazy(() => import('workspace/WorkspacePanelWidget'))
const WorkspaceOverviewTeaserWidget = lazy(() => import('workspace/WorkspaceOverviewTeaserWidget'))

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
  'inventory.project-items': {
    id: 'inventory.project-items',
    name: 'Project Items',
    description: 'Items assigned to one project',
    configSchema: { project_slug: { type: 'string', label: 'Project slug', required: true } },
    component: InventoryProjectItemsWidget,
    defaultIcon: 'package',
  },
  'knowledge.project-tasks': {
    id: 'knowledge.project-tasks',
    name: 'Project Tasks',
    description: 'Open tasks and notes for one vault project',
    configSchema: { project_slug: { type: 'string', label: 'Project slug', required: true } },
    component: KnowledgeProjectTasksWidget,
    defaultIcon: 'check-square',
  },
  'knowledge.writing': {
    id: 'knowledge.writing',
    name: 'Writing',
    description: 'Writing projects with chapter status, word counts, and tracked writing sessions',
    configSchema: {},
    component: WritingWidget,
    defaultIcon: 'pen-line',
    defaultOpenPath: '/#/writing',
  },
  'knowledge.music': {
    id: 'knowledge.music',
    name: 'Music',
    description: 'Practice log, theory curriculum, and ear-training/scales/sight-reading progress',
    configSchema: {},
    component: MusicWidget,
    defaultIcon: 'music',
    defaultOpenPath: '/#/music',
  },
  'workspace.panel': {
    id: 'workspace.panel',
    name: 'Workspace',
    description: 'Composes widgets from other satellites into one card',
    configSchema: {
      label: { type: 'string', label: 'Label', required: true },
    },
    component: WorkspacePanelWidget,
    defaultIcon: 'folder',
  },
  'workspace.overview-teaser': {
    id: 'workspace.overview-teaser',
    name: 'Workspace Overview',
    description: 'Link out to the full productivity-mode overview at workspace.station',
    configSchema: {},
    component: WorkspaceOverviewTeaserWidget,
    defaultIcon: 'layout-dashboard',
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
