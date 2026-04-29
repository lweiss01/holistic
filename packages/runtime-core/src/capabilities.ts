export interface RuntimeCapabilities {
  canPause: boolean;
  canResume: boolean;
  canStop: boolean;
  canRequestApproval: boolean;
  canStreamStructuredEvents: boolean;
  canCreateWorktree: boolean;
  canReportToolUse: boolean;
  canReportTokenUsage: boolean;
}
