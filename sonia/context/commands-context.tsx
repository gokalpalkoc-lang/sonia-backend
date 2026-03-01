import { apiFetch } from "@/lib/api";
import type { Command } from "@/types/command";
import React, { createContext, useContext, useState } from "react";

interface CommandsContextType {
  commands: Command[];
  setCommands: React.Dispatch<React.SetStateAction<Command[]>>;
  addCommand: (cmd: Command) => void;
  deleteCommand: (index: number) => void;
  toggleExpand: (index: number) => void;
}

const CommandsContext = createContext<CommandsContextType | null>(null);

export function CommandsProvider({ children }: { children: React.ReactNode }) {
  const [commands, setCommands] = useState<Command[]>([]);

  const addCommand = (cmd: Command) =>
    setCommands((prev) => {
      const key = cmd.id ?? `${cmd.time}-${cmd.prompt}`;
      const exists = prev.some((item) => (item.id ?? `${item.time}-${item.prompt}`) === key);
      return exists ? prev : [...prev, cmd];
    });

  const deleteCommand = (index: number) => {
    setCommands((prev) => prev.filter((_, i) => i !== index));
    apiFetch(`/api/commands`, { method: "DELETE", body: JSON.stringify({ assistantId: commands[index]?.assistantId }) }).catch((error) => {
      console.error(`Failed to delete command at index ${index}:`, error);
    });
  };

  const toggleExpand = (index: number) =>
    setCommands((prev) =>
      prev.map((cmd, i) =>
        i === index ? { ...cmd, expanded: !cmd.expanded } : cmd
      )
    );

  return (
    <CommandsContext.Provider
      value={{ commands, setCommands, addCommand, deleteCommand, toggleExpand }}
    >
      {children}
    </CommandsContext.Provider>
  );
}

export function useCommands() {
  const ctx = useContext(CommandsContext);
  if (!ctx) throw new Error("useCommands must be used within CommandsProvider");
  return ctx;
}
