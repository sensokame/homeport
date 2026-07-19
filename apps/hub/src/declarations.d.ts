declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}

declare module 'vikunja/TaskOverviewWidget' {
  import type { WidgetComponent } from '@homeport/ui'
  const component: WidgetComponent
  export default component
}

declare module 'vikunja/ProjectFocusWidget' {
  import type { WidgetComponent } from '@homeport/ui'
  const component: WidgetComponent
  export default component
}

declare module 'budget/BudgetWidget' {
  import type { WidgetComponent } from '@homeport/ui'
  const component: WidgetComponent
  export default component
}

declare module 'gcal/CalendarWidget' {
  import type { WidgetComponent } from '@homeport/ui'
  const component: WidgetComponent
  export default component
}

declare module 'infra/InfraWidget' {
  import type { WidgetComponent } from '@homeport/ui'
  const component: WidgetComponent
  export default component
}

declare module 'inventory/InventoryOverviewWidget' {
  import type { WidgetComponent } from '@homeport/ui'
  const component: WidgetComponent
  export default component
}

declare module 'knowledge/ReadingWidget' {
  import type { WidgetComponent } from '@homeport/ui'
  const component: WidgetComponent
  export default component
}

declare module 'knowledge/ProjectTasksWidget' {
  import type { WidgetComponent } from '@homeport/ui'
  const component: WidgetComponent
  export default component
}

declare module 'knowledge/WritingWidget' {
  import type { WidgetComponent } from '@homeport/ui'
  const component: WidgetComponent
  export default component
}

declare module 'knowledge/MusicWidget' {
  import type { WidgetComponent } from '@homeport/ui'
  const component: WidgetComponent
  export default component
}

declare module 'inventory/ProjectItemsWidget' {
  import type { WidgetComponent } from '@homeport/ui'
  const component: WidgetComponent
  export default component
}

declare module 'workspace/WorkspacePanelWidget' {
  import type { WidgetComponent } from '@homeport/ui'
  const component: WidgetComponent
  export default component
}

declare module 'workspace/WorkspaceOverviewTeaserWidget' {
  import type { WidgetComponent } from '@homeport/ui'
  const component: WidgetComponent
  export default component
}

declare module 'wger/FitnessWidget' {
  import type { WidgetComponent } from '@homeport/ui'
  const component: WidgetComponent
  export default component
}
