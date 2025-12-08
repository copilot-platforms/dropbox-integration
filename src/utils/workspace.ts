import { CopilotAPI } from '@/lib/copilot/CopilotAPI'
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

export async function getWorkspace(token: string): Promise<WorkspaceResponse> {
  const copilot = new CopilotAPI(token)
  return await copilot.getWorkspace()
}
