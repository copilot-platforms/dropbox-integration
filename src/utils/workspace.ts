import type { WorkspaceResponse } from '@/lib/copilot/types'

export const getWorkspaceLabel = (
  workspace: WorkspaceResponse,
  key: keyof NonNullable<WorkspaceResponse['labels']>,
) => {
  return {
    individualTerm: workspace.labels?.individualTerm?.toLowerCase() || 'client',
    individualTermPlural: workspace.labels?.individualTermPlural?.toLowerCase() || 'clients',
    groupTerm: workspace.labels?.groupTerm?.toLowerCase() || 'company',
    groupTermPlural: workspace.labels?.groupTermPlural?.toLowerCase() || 'companies',
  }[key]
}
