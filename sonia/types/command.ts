export interface Command {
  id?: string;
  assistantName?: string;
  time: string;
  prompt: string;
  firstMessage?: string;
  expanded: boolean;
}
