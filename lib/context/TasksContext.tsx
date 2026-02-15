"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { Task, Bid } from "@/lib/types/task";
import { MOCK_TASKS, MOCK_BIDS } from "@/lib/mock-data";

interface TasksContextType {
  tasks: Task[];
  bids: Bid[];
  addTask: (task: Task) => void;
  addBid: (bid: Bid) => void;
}

const TasksContext = createContext<TasksContextType | undefined>(undefined);

export function TasksProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS);
  const [bids, setBids] = useState<Bid[]>(MOCK_BIDS);

  const addTask = (task: Task) => {
    setTasks((prev) => [task, ...prev]);
  };

  const addBid = (bid: Bid) => {
    setBids((prev) => [bid, ...prev]);
  };

  return (
    <TasksContext.Provider value={{ tasks, bids, addTask, addBid }}>
      {children}
    </TasksContext.Provider>
  );
}

export function useTasks() {
  const context = useContext(TasksContext);
  if (context === undefined) {
    throw new Error("useTasks must be used within a TasksProvider");
  }
  return context;
}
