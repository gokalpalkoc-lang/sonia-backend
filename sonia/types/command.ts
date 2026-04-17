export interface Command {
  id?: number | string;
  time: string;
  prompt: string;
  firstMessage?: string;
  expanded: boolean;
}
